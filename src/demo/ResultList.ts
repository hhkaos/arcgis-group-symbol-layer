import { safeUrl } from "../layer/model";

export interface ResultRow {
  key: string; label: string; description: string; image?: string;
  activate(): void;
}
interface RowNodes {
  button: HTMLButtonElement; image: HTMLSpanElement; name: HTMLSpanElement; description: HTMLSpanElement;
  data: ResultRow; imageUrl?: string; initials: string;
}

/** Reconcile paginated rows by identity; retain loaded images and keyboard focus. */
export class ResultList {
  private rows = new Map<string, RowNodes>();
  private empty = document.createElement("p");
  constructor(private container: HTMLElement) {
    this.empty.className = "empty";
    container.tabIndex = -1;
  }
  render(items: ResultRow[], emptyMessage: string): void {
    const keys = new Set(items.map(item => item.key));
    const focused = [...this.rows].find(([, row]) => row.button.contains(document.activeElement));
    for (const [key, row] of this.rows) if (!keys.has(key)) { row.button.remove(); this.rows.delete(key); }
    if (items.length) this.empty.remove();
    for (const [index, item] of items.entries()) {
      let row = this.rows.get(item.key);
      if (!row) {
        const button = document.createElement("button"); button.className = "result-item";
        const image = document.createElement("span"); image.className = "result-image";
        const text = document.createElement("span"), name = document.createElement("span"), description = document.createElement("span");
        name.className = "result-name"; description.className = "result-description";
        text.append(name, description); button.append(image, text);
        row = { button, image, name, description, data: item, initials: "" };
        const current = row;
        button.addEventListener("click", () => current.data.activate());
        this.rows.set(item.key, row);
      }
      row.data = item;
      if (row.name.textContent !== item.label) row.name.textContent = item.label;
      if (row.description.textContent !== item.description) row.description.textContent = item.description;
      const url = safeUrl(item.image), initials = item.label.slice(0, 2).toLocaleUpperCase();
      if (row.imageUrl !== url || row.initials !== initials) {
        row.imageUrl = url; row.initials = initials;
        row.image.replaceChildren(document.createTextNode(initials));
        if (url) {
          const img = document.createElement("img"); img.alt = ""; img.loading = "lazy";
          const holder = row.image;
          img.addEventListener("load", () => { if (holder.contains(img) && holder.firstChild?.nodeType === Node.TEXT_NODE) holder.firstChild.remove(); }, { once: true });
          img.addEventListener("error", () => img.remove(), { once: true });
          img.src = url; holder.append(img);
        }
      }
      const atIndex = this.container.children[index];
      if (atIndex !== row.button) this.container.insertBefore(row.button, atIndex ?? null);
    }
    if (!items.length) {
      if (this.empty.textContent !== emptyMessage) this.empty.textContent = emptyMessage;
      if (!this.empty.isConnected) this.container.append(this.empty);
    }
    if (focused && document.activeElement !== this.rows.get(focused[0])?.button) {
      (this.rows.get(focused[0])?.button ?? this.container).focus({ preventScroll: true });
    }
  }
}

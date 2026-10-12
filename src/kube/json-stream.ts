// Splits a byte stream of concatenated JSON values (kubectl's watch output)
// into parsed objects. Tracks brace depth outside strings, so it doesn't
// depend on kubectl printing one object per line.

export class JsonStreamSplitter<T> {
  private buffer = "";
  private depth = 0;
  private inString = false;
  private escaped = false;
  private start = -1;
  private scanned = 0;

  push(chunk: string): T[] {
    this.buffer += chunk;
    const out: T[] = [];
    for (let i = this.scanned; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === "\\") this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }
      if (ch === '"') this.inString = true;
      else if (ch === "{") {
        if (this.depth === 0) this.start = i;
        this.depth++;
      } else if (ch === "}") {
        this.depth--;
        if (this.depth === 0 && this.start >= 0) {
          out.push(JSON.parse(this.buffer.slice(this.start, i + 1)) as T);
          this.start = -1;
        }
      }
    }
    if (this.depth === 0) {
      this.buffer = "";
      this.scanned = 0;
    } else {
      this.buffer = this.buffer.slice(this.start);
      this.scanned = this.buffer.length;
      this.start = 0;
    }
    return out;
  }
}

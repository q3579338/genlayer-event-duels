// A response is usable only while its account/network/contract context is current.
export class ReadGuard {
  private generation = 0;
  invalidate() { this.generation++; }
  begin() {
    const generation = ++this.generation;
    return () => this.generation === generation;
  }
}

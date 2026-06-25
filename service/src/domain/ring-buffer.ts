export class RingBuffer<T> {
  private items: T[] = [];

  constructor(private readonly limit: number) {}

  push(item: T) {
    this.items.push(item);
    if (this.items.length > this.limit) this.items.shift();
  }

  snapshot(): T[] {
    return [...this.items];
  }
}

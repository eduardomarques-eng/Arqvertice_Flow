/** LRU Cache com teto máximo de entradas para prevenir vazamento de memória. */
export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly map = new Map<K, V>();
  private readonly keys: K[] = [];
  private _size = 0;

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error("LRUCache capacity must be positive");
    this.capacity = capacity;
  }

  get size(): number {
    return this._size;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.touch(key);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.set(key, value);
      this.touch(key);
      return;
    }

    this.map.set(key, value);
    this.keys.push(key);
    this._size++;

    if (this._size > this.capacity) {
      const evicted = this.keys.shift();
      if (evicted !== undefined) {
        this.map.delete(evicted);
        this._size--;
      }
    }
  }

  delete(key: K): boolean {
    const existed = this.map.delete(key);
    if (existed) {
      const index = this.keys.indexOf(key);
      if (index >= 0) {
        this.keys.splice(index, 1);
        this._size--;
      }
    }
    return existed;
  }

  clear(): void {
    this.map.clear();
    this.keys.length = 0;
    this._size = 0;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  private touch(key: K): void {
    const index = this.keys.indexOf(key);
    if (index >= 0) {
      this.keys.splice(index, 1);
      this.keys.push(key);
    }
  }

  /** Limpa itens mais antigos (FIFO) para liberar memória. */
  evictOldest(): V | undefined {
    const evicted = this.keys.shift();
    if (evicted !== undefined) {
      const value = this.map.delete(evicted);
      if (value !== undefined) {
        this._size--;
      }
      return value;
    }
    return undefined;
  }

  /** Libera toda a memória do cache (chamada em shutdown). */
  destroy(): void {
    this.map.clear();
    this.keys.length = 0;
    this._size = 0;
  }
}

export function createLRUCache<K, V>(capacity: number): LRUCache<K, V> {
  return new LRUCache<K, V>(capacity);
}
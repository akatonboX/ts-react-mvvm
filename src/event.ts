export type EventHandler<T> = (sender: any, args: T) => void;
/**
 * Eventを表すクラス
 */
export class Event<T> {
  handlers: EventHandler<T>[] = [];

  /** イベントハンドラを追加する */
  add(handler: EventHandler<T>): void{
    if (this.handlers.find((item) => item === handler) == null) {
      this.handlers.push(handler);
    }
  }

  /** イベントハンドラを削除する */
  remove(handler: EventHandler<T>): void{
    this.handlers = this.handlers.filter((item) => item !== handler);
  }

  /** 初期化する */
  dispose(): void{
    this.handlers = [];
  }

  call(sender: any, args: T) {
    for (const handler of this.handlers) {
      handler(sender, args);
    }
  }
}

export declare type EventHandler<T> = (sender: any, args: T) => void;
/**
 * Eventを表すクラス
 */
export declare class Event<T> {
    handlers: EventHandler<T>[];
    /** イベントハンドラを追加する */
    add(handler: EventHandler<T>): void;
    /** イベントハンドラを削除する */
    remove(handler: EventHandler<T>): void;
    /** 初期化する */
    dispose(): void;
    call(sender: any, args: T): void;
}

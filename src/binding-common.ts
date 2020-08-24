import { $path, Path, TypedPath } from "./path";
import { Binding, $bind } from "./binding-receiver";


export type SourceKey = string | number | symbol;
export const Invalid = Symbol("Invalid");
export type InvalidType = typeof Invalid;

export const bindingPathSymbol = Symbol("BindingPath");
export interface BindingPath {
  readonly $sourceKey: SourceKey;
  readonly $path: Path;
  $contains(bindingPath: BindingPath): boolean;
  $equals(bindingPath: BindingPath): boolean;
  $asTypedBindingPath<T>(): TypedBindingPath<T>;
  $type: Symbol;
}


export type TypedBindingPath<T> = (
  T extends Array<infer Z>
  ? {
      [index: number]: TypedBindingPath<Z>;
      length: TypedBindingPath<number>;
  }:
  {
    readonly [K in keyof T]-?: TypedBindingPath<T[K] extends infer A ? A : never>;
  }
)
& {
  $path: TypedPath<T>;
  $getChild<T_CHILD>(propertyKey: PropertyKey): TypedBindingPath<T_CHILD>;
  $asBinding(): Binding<T>;
  $asBinding<T_RESULT>(defaultOrconverter?: ((prop: T | undefined) => T_RESULT) | T_RESULT): Binding<T_RESULT>;
}
& BindingPath;

class TypedBindingPathImpl<T> implements BindingPath{
  readonly $sourceKey: SourceKey;
  readonly $path: TypedPath<T>;
  get $type(){return bindingPathSymbol;}
  constructor(sourceKey: SourceKey, path?: TypedPath<T>){
    this.$sourceKey = sourceKey;
    this.$path = path === undefined ? $path<T>() : path;
  }

  $contains(bindingPath: BindingPath): boolean{
    return this.$sourceKey === bindingPath.$sourceKey && this.$path.$contains(bindingPath.$path);
  }
  $equals(bindingPath: BindingPath): boolean{
    return this.$sourceKey === bindingPath.$sourceKey && this.$path.$equals(bindingPath.$path);
  }
  $asTypedBindingPath<T>(){
    return this as any as TypedBindingPath<T>;
  }
  $getChild<T>(propertyKey: PropertyKey){
    return $bindingPath(this.$sourceKey, this.$path.$getChild(propertyKey).$asTypedPath<T>());
  }
  $asBinding(defaultOrconverter?: ((prop: T | undefined) => any) | any){
    return $bind(_bindingPath(this.$sourceKey, this.$path), defaultOrconverter);
  }
}

export function $bindingPath<T>(souceKey: SourceKey, path?: TypedPath<T>, defaultValue?: T): TypedBindingPath<T>{
  return _bindingPath<T>(souceKey, path === undefined ? $path<T>() : path);
}

function _bindingPath<T>(souceKey: SourceKey, path: TypedPath<T>): TypedBindingPath<T>{
  return new Proxy(new TypedBindingPathImpl(souceKey, path) as any, {
    get: function<T>(target: T, name: PropertyKey, receiver: any): any {
      if(name in target){
        return Reflect.get(target as any, name, receiver);
      }
      else{
        return _bindingPath(souceKey, path.$getChild(name).$asTypedPath());
      }
    },
  }) as TypedBindingPath<T>;
}

export function isBindingPath(item: any): item is BindingPath {
  return item.$type === bindingPathSymbol;
}



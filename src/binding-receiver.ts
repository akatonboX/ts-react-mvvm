import { BindingSource, SourceManager } from "./binding-source";
import { Path, TypedPath, $path, $pathFrom } from "./path";
import { BindingPath, SourceKey, $bindingPath, TypedBindingPath } from "./binding-common";
import { isFunction } from "util";

export interface Binding<T_RESULT>{
  readonly hasConverter: boolean;
  readonly hasDefaultValue: boolean;
  readonly isMultiBinding: boolean;
  getValue(receiver: BindingReceiver): T_RESULT | undefined;
  readonly bindingPath?: TypedBindingPath<T_RESULT>;

}

class SingleBinding<T_SOURCE, T_RESULT> implements Binding<T_RESULT>{
  source: TypedBindingPath<T_SOURCE>;
  defaultValue: T_RESULT | undefined;
  converter: ((prop: T_SOURCE) => T_RESULT) | undefined;
  constructor(
    source: TypedBindingPath<T_SOURCE>, 
    defaultValue?: T_RESULT,
    converter?: (prop: T_SOURCE) => T_RESULT
  ){
    this.source = source; 
    this.defaultValue = defaultValue;
    this.converter = converter;
  }

  get hasConverter(){ return this.converter !== undefined;}
  get hasDefaultValue(){ return this.defaultValue !== undefined;}
  get isMultiBinding(){return false;}
  get bindingPath(){ return this.source.$asTypedBindingPath<T_RESULT>();};
  getValue(receiver: BindingReceiver): T_RESULT | undefined{
    const value = receiver.get<T_SOURCE>(this.source);
    const converted = value === undefined ? this.defaultValue : this.converter === undefined ? value as any as T_RESULT : this.converter(value);
    const result = converted === undefined ? this.defaultValue : converted;
    return result;
  }

}

class MultiBinding<T_SOURCE, T_RESULT> implements Binding<T_RESULT>{
  source: {[K in keyof T_SOURCE]-?: Binding<T_SOURCE[K]>};
  converter: ((props: {[K in keyof T_SOURCE]+?: T_SOURCE[K]}) => T_RESULT);

  constructor(
    source: {[K in keyof T_SOURCE]-?: Binding<T_SOURCE[K]>}, 
    converter: (props: {[K in keyof T_SOURCE]+?: T_SOURCE[K]}) => T_RESULT
  ){
    this.source = source; 
    this.converter = converter;
  }
  get hasConverter(){ return true;}
  get hasDefaultValue(){ return false;}
  get isMultiBinding(){return true;}
  get bindingPath(): TypedBindingPath<T_RESULT> | undefined { return undefined;};
  getValue(receiver: BindingReceiver): T_RESULT | undefined {
    const prop = {} as {[K in keyof T_SOURCE]+?: T_SOURCE[K]};
    for(const name in this.source){
      prop[name] = this.source[name].getValue(receiver);
    }
    const result = this.converter(prop);
    return result;
  }

}

export function $bind<T_SOURCE>(source: TypedBindingPath<T_SOURCE>): Binding<T_SOURCE>;
export function $bind<T_SOURCE, T_RESULT = T_SOURCE>(source: TypedBindingPath<T_SOURCE>, defaultValue?: T_RESULT): Binding<T_RESULT>;
export function $bind<T_SOURCE, T_RESULT = T_SOURCE>(source: TypedBindingPath<T_SOURCE>, converter?: (prop: T_SOURCE) => T_RESULT): Binding<T_RESULT>;
export function $bind(source: TypedBindingPath<any>, param?: ((prop: any) => any) | any): Binding<any>
{
  const defaultValue = isFunction(param) ? undefined : param;
  const converter = isFunction(param) ? param : undefined;
  return new SingleBinding(source, defaultValue, converter);
}

export function $mbind<T_SOURCE, T_RESULT>(
  source: {[K in keyof T_SOURCE]-?: Binding<T_SOURCE[K]>}, 
  converter: (props: {[K in keyof T_SOURCE]+?: T_SOURCE[K]}) => T_RESULT,
){
  return new MultiBinding(source, converter);
}
export function isBinding<T>(item: any): item is Binding<T>{
  return item instanceof SingleBinding || item instanceof MultiBinding;
}
export class BindingReceiver{
  private usedBindingPaths: BindingPath[] = [];
  private renderConditions: {
    sourceKey: SourceKey,
    filter: (bindingSource: BindingSource, path: Path, oldValue: any, newValue: any) => boolean,
  }[] = [];
  private sourceRenderedVersions: {
    sourceKey: SourceKey,
    version: number | undefined,
  }[] = [];

  constructor() {

  }
  isOld(): boolean{
    
    const result = this.sourceRenderedVersions.reduce((previousValue, currentItem) => {
      if(previousValue)
        return true;
      const source = SourceManager.find(currentItem.sourceKey);
      return (source === undefined && currentItem.version !== undefined) || (source !== undefined && currentItem.version !== source.version)
    }, false);
    
    return result;
  }
  hasSource(sourceKey: SourceKey){
    return this.sourceRenderedVersions.find(item => item.sourceKey === sourceKey) !== undefined;
  }
  needRender(sourceKey: SourceKey, path: Path, oldValue: any, newValue: any): boolean{
    if(this.usedBindingPaths.find(usedBindingPath => usedBindingPath.$sourceKey === sourceKey && path.$contains(usedBindingPath.$path)) !== undefined){
      return true;
    }
    const filters = this.renderConditions.filter(item => item.sourceKey === sourceKey).map(item => item.filter);
    if(filters.length > 0){
      const source = SourceManager.find(sourceKey);
      if(source !== undefined){
        const result = filters.reduce((previouseValue, filter) => {
          if(previouseValue)
            return true;
          return filter(source, path, oldValue, newValue);
        }, false);
        return result;
      }
      else{
        if(this.sourceRenderedVersions.find(item => item.sourceKey === sourceKey && item.version !== undefined) !== undefined){
          return true;
        }
      }
    }
    return false;
  }
  private addSourceRenderedVersions(sourceKey: SourceKey){
    if(this.sourceRenderedVersions.find(item => item.sourceKey === sourceKey) === undefined){
      const source = SourceManager.find(sourceKey);
      this.sourceRenderedVersions = [...this.sourceRenderedVersions, { sourceKey: sourceKey, version: source === undefined ? undefined : source.version }]
    }
  }
  registUsedPath(bindingPath: BindingPath){
    this.addSourceRenderedVersions(bindingPath.$sourceKey);
    if(this.usedBindingPaths.find(usedBindingPath => usedBindingPath.$contains(bindingPath)) === undefined){
      this.usedBindingPaths = [...this.usedBindingPaths.filter(usedBindingPath => !bindingPath.$contains(usedBindingPath)), bindingPath];
    }
  }
  registRenderCondition(sourceKey: SourceKey, filter:  (bindingSource: BindingSource, path: Path, oldValue: any, newValue: any) => boolean){
    this.addSourceRenderedVersions(sourceKey);
    this.renderConditions.push({
      sourceKey: sourceKey,
      filter: filter,
    });
  }
  get<T>(target: TypedBindingPath<T> | BindingPath): T | undefined {
    this.registUsedPath(target);
    return this.getOnly(target);
  }

  getOnly<T>(target: TypedBindingPath<T> | BindingPath): T | undefined {
    const source = SourceManager.find(target.$sourceKey);
    if(source === undefined)
      return undefined;
    return source.getValue(target.$path) as  T | undefined;
  }
/*
  getWithDefault<T>(bindingPath: TypedBindingPath<T>, defaultValue: T): T {
    const result = this.get(bindingPath);
    return result === undefined ? defaultValue : result;
  }
*/

  createBindingProxy<T>(target: TypedBindingPath<T> | BindingPath): BindingProxy<T>{
    return createBindingProxy(this, target.$sourceKey, target.$path.$asTypedPath<T>());
  }
  
}
interface BindingProxyBase<T>{
  $get(defaultValue: NonNullable<T>): NonNullable<T>;
  readonly $value: T | undefined;
  readonly $path: TypedPath<T>;
  readonly $receiver: BindingReceiver;
} 


export type BindingProxy<T> =  (
  T extends Array<infer Z>
  ? {
    readonly [index: number]: BindingProxy<Z>;
  }:
  {
    readonly [K in keyof T]-?: BindingProxy<T[K] extends infer A ? A : never>;
  }
) & BindingProxyBase<T>;

class BindingProxyImpl<T> {
  readonly $receiver: BindingReceiver;
  readonly $sourceKey: SourceKey;
  readonly $path: TypedPath<T>;
  

  constructor(receiver: BindingReceiver, sourceKey: SourceKey, path: TypedPath<T>){
    this.$sourceKey = sourceKey;
    this.$path = path;
    this.$receiver = receiver;
  }
  $get(defaultValue: NonNullable<T>){
    const value = this.get();
    return value === undefined ? defaultValue : value;
  }
  get(): T | undefined{
    return this.$receiver.get($bindingPath(this.$sourceKey, this.$path));
  }
  /*
  $get(defaultValue: T): T {
    return this.$biding.getWithDefault(this.$bidingPath, defaultValue);
  }
*/
  $getRoot<T_ROOT>(){
    return createBindingProxy(this.$receiver, this.$sourceKey, $path<T_ROOT>());
  }
  $getParent<T_PARENT>(){
    const names = this.$path.$toArray();
    return createBindingProxy(this.$receiver, this.$sourceKey, $pathFrom<T_PARENT>(names.filter((item, index) => index < names.length - 1)));
  }
}

function createBindingProxy<T>(receiver: BindingReceiver, sourceKey: SourceKey, path: TypedPath<T>): BindingProxy<T>{
  return new Proxy(new BindingProxyImpl(receiver, sourceKey, path) as any, {
    get: function<T>(target: BindingProxyImpl<T>, name: PropertyKey, rec: any): any {
      if(name in target){
        return Reflect.get(target, name, receiver);
      }
      else{
        switch(name){
          case "$value":
            return target.get();
          case "$receiver":
            return target.$receiver;
          case "$sourceKey":
            return target.$sourceKey;
          case "$path":
            return target.$path;
          default:
            return createBindingProxy(receiver, sourceKey, path.$getChild(name).$asTypedPath());
        }
      }
    },
  }) as BindingProxy<T>;
}
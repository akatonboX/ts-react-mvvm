import * as lodash from "lodash";
import { SourceKey, $bindingPath, BindingPath, TypedBindingPath} from "./binding-common";
import { $path, $pathFrom, Path, TypedPath } from "./path";
import { EventManager, createValueChangedEventArgs, SourceChangedEventArgs, ValueChangedEventArgs } from "./binding-event";
import { isFunction, isObject, isArray, isNumber } from "util";
import { InputManager } from "./binding-input";


export class _SourceManager{
  private bindingSources: BindingSource[] = [];

  find(sourceKey: SourceKey): BindingSource | undefined{
    const bindingSource = this.bindingSources.find(item => item.sourceKey === sourceKey);
    return bindingSource == null ? undefined : bindingSource;
  }
  get(sourceKey: SourceKey): BindingSource{
    const bindingSource = this.find(sourceKey);
    if(bindingSource === undefined){
      throw Error(`_SourceManager.get(): not found. sourceKey=${String(sourceKey)}`);
    }
    return bindingSource;
  }
  regist(bindingSource: BindingSource): void{
    if(this.find(bindingSource.sourceKey) !== undefined)
      throw Error(`Key already exists. sourceKey=${String(bindingSource.sourceKey)}`);
    this.bindingSources.push(bindingSource);
  }
  remove(sourceKey: SourceKey): void{
    const bindingSource = this.find(sourceKey);
    if(bindingSource === undefined)
      throw new Error(`BindingSourceManager.remove: Key does not exist. sourceKey = ${sourceKey.toString()}`);
    
    this.bindingSources = this.bindingSources.filter(item => item.sourceKey !== sourceKey);
    bindingSource.dispose();
  }

  getValue<T>(sourceKey: SourceKey, path: TypedPath<T>, defaultValue: T): T{
    const source = this.find(sourceKey);
    if(source === undefined)
      return defaultValue;
    const value = source.getValue(path);
    if(value === undefined)
      return defaultValue;
    return value;

  }
}

export const SourceManager = new _SourceManager();
if(process.env.NODE_ENV === "development")
  (window as any).SourceManager = SourceManager;


export interface BindingSource{
  readonly sourceKey: SourceKey;
  readonly initParam: any;
  readonly source: any;
  readonly version: number;
  update(param: any): void;
  reset(): void;
  commit(): void;
  readonly hasChange: boolean;
  getValue(path: Path): any | undefined;
  hasPath(path: Path): boolean;
  setValue(path: Path, value: any | undefined): void;
  createSourceProxy<T = any>(path?: TypedPath<T>): SourceProxy<T>;
  dispose(): void;
  readonly hasError: boolean;
  validate(): void;
}

abstract class BindingSourceBase<T_INIT_PARAM> implements BindingSource{
  readonly sourceKey: SourceKey;
  private _initParam: T_INIT_PARAM;
  get initParam(){return this._initParam;}
  private _source: any;
  get source(){return this._source;}
  private _version: number;
  get version(){return this._version;}
  private _hasChange: boolean = false;

  constructor(sourceKey: SourceKey, initParam: T_INIT_PARAM){
    this.sourceKey = sourceKey;
    this._initParam = initParam;
    this._version = 1;
    this.updateInitParam(initParam);
  }

 
  private findValue<T>(path: Path): any | undefined{
    if(path.$toArray().length === 0){
      return this.source;
    }
    else{
      return lodash.get(this.source, path.$toString());
    }
  }
  
  protected abstract updateInitParam(initParam: T_INIT_PARAM): void;

  protected setSource(source: any){
    this._source = source;
  }
  update(param: T_INIT_PARAM): void {
    const oldSource = this.source;
    this._initParam = param;
    this.updateInitParam(param);
    this._version = this._version === Number.MAX_VALUE ? 1 : this._version + 1;
    this._hasChange = false;
    InputManager.findBySourceKey(this.sourceKey).forEach(input => input.reset());
    EventManager.sourceChanged.call(this, { sourceKey: this.sourceKey, oldSource: oldSource, newSource: this.source});
  }

  reset(): void {
    this.update(this.initParam);
  }
  abstract commit(): void;
  
  get hasChange(): boolean {
    return this._hasChange;
  }
  getValue(path: Path) {
    const result = this.findValue(path);
    return result === undefined ? undefined : result;
  }
  hasPath(path: Path): boolean {
    return lodash.has(this.source, path.$toString());
  }
  setValue(path: Path, value: any | undefined): void{
    const oldValue = this.getValue(path);
    const changedEventArgs = createValueChangedEventArgs(this.sourceKey, path, oldValue, value);
    if(changedEventArgs.changes.length > 0){
      this._hasChange = true;

      if(path.$toArray().length == 0){
        this._source = value;
      }
      else{
        lodash.set(this.source, path.$toString(), value);
      }
      
      changedEventArgs.changes.forEach(change => {
        const bindingPath = $bindingPath(changedEventArgs.sourceKey, change.path.$asTypedPath());
        const inputs = InputManager.findByPath(bindingPath);
        inputs.forEach(input => input.reset());
        const dependenceInputs = InputManager.findByDependence(bindingPath);
        dependenceInputs.forEach(input => input.validate());
      });
      EventManager.valueChanged.call(this, changedEventArgs);
    }

    const changingEventArgs = {
      sourceKey: this.sourceKey,
      path: path,
      oldValue: oldValue,
      newValue: value,
      isCancel: false,
    }

  }
  createSourceProxy<T = any>(path?: TypedPath<T> | undefined): SourceProxy<T> {
    return new SourceProxy(this.sourceKey, path);
  }
  get hasError(){
    return InputManager.findBySourceKey(this.sourceKey).find(item => item.getError().length > 0) !== undefined;
  }
  validate(){
    const inputs = InputManager.findBySourceKey(this.sourceKey);
    inputs.forEach(inputRef => {
      inputRef.setError([]);
      if(inputRef.isEnable)
        inputRef.validate();
    });
  }
  dispose(): void {

  }
  
}

export class NormalBindingSource extends BindingSourceBase<any>{
  constructor(sourceKey: SourceKey, source: any) {
    super(sourceKey, source);
  }

  protected updateInitParam(initParam: any): void {
    this.setSource(lodash.cloneDeep(initParam));
  }
  commit(): void {

    this.update(this.source);
  }

}



export type SourceProxyItem<T> = (
  T extends Array<infer Z> ? Array<SourceProxyItem<Z>>
  : T extends object ? {
      [K in keyof T]: (
        T[K] extends Object ? SourceProxyItem<T[K]>
        : T[K]
      )
  } & T
  : T
);

export class SourceProxyBase<T>{
  readonly bindingPath: BindingPath;
  constructor(sourceKey: SourceKey, path?: TypedPath<T>){
    this.bindingPath = $bindingPath(sourceKey, path);
  }

  getData(){
    const bindingSource = SourceManager.find(this.bindingPath.$sourceKey);
    if(bindingSource !== undefined){
      const value = bindingSource.getValue(this.bindingPath.$path);
      if(isObject(value)){
        return new Proxy(value, new SourceProxyItemHandler(bindingSource, this.bindingPath.$path)) as T;
      }
      else{
        return value;
      }
    }
    else{
      throw Error(`SourceProxy.data: not Found bindingSource. sourcekey=${String(this.bindingPath.$sourceKey)}, path=${this.bindingPath.$path.$toString()}`);
    }
  }
}
export class SourceProxy<T> extends SourceProxyBase<T>{
  constructor(sourceKey: SourceKey, path?: TypedPath<T>){
    super(sourceKey, path);
  }
  get data(): T{
    return this.getData();
  }

  getRoot<T_ROOT>(){
    return new SourceProxy(this.bindingPath.$sourceKey, $path<T_ROOT>())
  }
  getParent<T_PARENT>(){
    const paths = this.bindingPath.$path.$toArray();
    return new SourceProxy(this.bindingPath.$sourceKey, $pathFrom<T_PARENT>(paths.slice(0, paths.length - 1)));
  }
}

class SourceProxyItemHandler<T extends object, T_SOURCE>{
  readonly bindingSouce: BindingSource;
  readonly path: Path;

  constructor(bindingSouce: BindingSource, path: Path){
    this.bindingSouce = bindingSouce;
    this.path = path;
  }

  get(target: T, name: PropertyKey, receiver: any): any{
    const currentValue = this.bindingSouce.getValue(this.path);
    const childPath = this.path.$getChild(name);
    const childValue = (currentValue as any)[name];
    if(name in target){
      if(isFunction(childValue)){
        return (...args: any[])=>{
          return Reflect.apply(childValue, currentValue, args);
        };
      }
      else if(isObject(childValue)){
        return new Proxy(childValue, new SourceProxyItemHandler(this.bindingSouce, childPath));
      }
      else{
        return this.bindingSouce.getValue(childPath);
      }
    }
    else{
      switch(name){
        case "$path":
          return this.path;
        case "$bindingSouce":
          return this.bindingSouce;
        default:
          throw Error(`SourceProxyHandler.get: not support property. name = ${String(name)}`);
      }
    }
  }

  set(target: T, name: PropertyKey, value: any, receiver: any): boolean{
    this.bindingSouce.setValue(this.path.$getChild(name), value);
    return true;
  }
}

export type NestedReadOnky<T> = {
  readonly [K in keyof T]:  NestedReadOnky<T[K]>;
}


export class ReadonlySourceProxy<T> extends SourceProxyBase<T>{
  constructor(sourceKey: SourceKey, path?: TypedPath<T>){
    super(sourceKey, path);
  }
  get data(): NestedReadOnky<T>{
    return this.getData();
  }
  getRoot<T_ROOT>(){
    return new ReadonlySourceProxy(this.bindingPath.$sourceKey, $path<T_ROOT>())
  }
  getParent<T_PARENT>(){
    const paths = this.bindingPath.$path.$toArray();
    return new ReadonlySourceProxy(this.bindingPath.$sourceKey, $pathFrom<T_PARENT>(paths.slice(0, paths.length - 1)));
  }
}

export interface CollectionSourceGroup<T>{
  key: string;
  data: T | undefined;
}
export interface CollectionSourceItem<T>{
  item: T;
  sourceIndex: number;
  groups: string[];
  sortKey: any;
  isVisible: boolean;
  isGroupHeaders: boolean[];
  isGroupFooters: boolean[];
}

function stringArraySort(item1: string[], item2: string[]){
  for(var i = 0; i < item1.length; i++){
    if(item1[i] < item2[i]){
      return -1;
    }
    else if(item1[i] > item2[i]){
      return 1;
    }
  }
  return 0;
}


interface CollectionSourceParam<T>{
  source: T[] | TypedBindingPath<T[]>,
  getSortKey?: (item1: T) => any;
  groupings?: ((item: T) => string)[];
  filter?: (item1: T) => boolean;
}

export class CollectionSource<T> extends BindingSourceBase<CollectionSourceParam<T>>{
  
  private get getSortKey(){return this.initParam.getSortKey;}
  private get groupings(){return this.initParam.groupings;}
  private get filter(){return this.initParam.filter;}
  private bindingPath: TypedBindingPath<T[]> | undefined = undefined;
  constructor(sourceKey: SourceKey, initParam: CollectionSourceParam<T>){
    super(sourceKey, initParam);
    if(!isArray(initParam.source)){
      this.bindingPath = initParam.source;
      this.sourceChangedHandler = this.sourceChangedHandler.bind(this)
      this.valueChangedHandler = this.valueChangedHandler.bind(this)
      EventManager.sourceChanged.add(this.sourceChangedHandler);
      EventManager.valueChanged.add(this.valueChangedHandler);  
    }
  }

  protected updateInitParam(initParam: CollectionSourceParam<T>): void {
    
    const items = (() => {
      if(isArray(initParam.source)){
        return initParam.source;
      }
      else if(!isArray(initParam.source)){
        this.bindingPath = initParam.source;
        const bindingSource = SourceManager.find(this.bindingPath.$sourceKey);
        if(bindingSource !== undefined){
          return bindingSource.getValue( this.bindingPath.$path) as T[];
        }
        return undefined;
      }
      else{
        throw Error("CollectionSource.updateInitParam(): initParam.source is Invalid type.");
      }

    })();
    this.setSource(this.createSource(items))
  }

  commit(): void {
    throw new Error("CollectionSourceParam.commit(): Method not implemented.");
  }
    

  private createSource(
    data: T[] | undefined,
  ): CollectionSourceItem<T>[]{
    if(data === undefined)
      return [];
    
    const defaultIsHeaders = this.groupings === undefined ? [] : this.groupings.map(item => false);
    const converted = data.map((item, index) => {
      return {
        sourceIndex: index,
        sortKey: this.getSortKey === undefined ? undefined : this.getSortKey(item),
        groups: this.groupings === undefined ? [] : this.groupings.map(grouping => grouping(item)), 
        isVisible: this.filter === undefined ? true : this.filter(item),
        item: item,
        isGroupHeaders: defaultIsHeaders,
        isGroupFooters: defaultIsHeaders,
      };
    });
    const sorted = converted.sort((item1, item2) => {
      const groupResult = stringArraySort(item1.groups, item2.groups);
      if(groupResult != 0)
        return groupResult;
      else if(item1.sortKey === item2.sortKey)
        return 0;
      else if(item1.sortKey < item2.sortKey)
        return -1;
      else
        return 1;
    });
    const sortedAndFilter = sorted.filter(item => item.isVisible);
    const length =  sortedAndFilter.length;
    for(var i = 0; i < length; i++){
      const item = sortedAndFilter[i];
      item.isGroupHeaders = i === 0 
        ? item.groups.map(item => true) 
        : item.groups.map((item, index) => sortedAndFilter[i - 1].groups[index] !== item);
      item.isGroupFooters = i === length - 1 
        ? item.groups.map(item => true) 
        : item.groups.map((item, index) => sortedAndFilter[i + 1].groups[index] !== item);
    }
    const result = sorted.map(item => {
      return {
        sourceIndex: item.sourceIndex,
        item: item.item,
        groups: item.groups,
        sortKey: item.sortKey,
        isVisible: item.isVisible,
        isGroupHeaders: item.isGroupHeaders,
        isGroupFooters: item.isGroupFooters,
      };
    })

    return result;
  }


  private async sourceChangedHandler(sender: BindingSource, args: SourceChangedEventArgs) {
    if(this.bindingPath !== undefined && sender.sourceKey === this.bindingPath.$sourceKey){
      
      this.update(this.initParam);
    }
  } 

  private async valueChangedHandler(sender: BindingSource, args: ValueChangedEventArgs) {
    if(this.bindingPath !== undefined && args.sourceKey === this.bindingPath.$sourceKey){
      
      if(this.bindingPath.$path.$equals(args.originalPath)){
        const newArgs: ValueChangedEventArgs = {
          sourceKey: this.sourceKey,
          originalPath: $path(),
          changes: [],
        };
        const oldSource = this.source;
        const newSource = this.createSource(sender.getValue(this.bindingPath.$path));
        this.setSource(newSource);
        if(oldSource.length != newSource.length){
          newArgs.changes.push({
            path: $pathFrom(["length"]),
            oldValue: oldSource.length,
            newValue: newSource.length,
          });
        }
        const length = oldSource.length > newSource.length ? oldSource.length : newSource.length;
        for(var i = 0; i < length; i++){
          const oldItem = i < oldSource.length ? oldSource[i] : undefined;
          const newItem = i < newSource.length ? newSource[i] : undefined;
          newArgs.changes.push({
            path: $pathFrom([i]),
            oldValue: oldItem,
            newValue: newItem,
          });
        }
        EventManager.valueChanged.call(this, newArgs);
      }
      else if(this.bindingPath.$path.$contains(args.originalPath)){
        const source = this.source as CollectionSourceItem<T>[];
        const index = args.originalPath.$toArray()[this.bindingPath.$path.$toArray().length];
        if(isNumber(index)){
          const newSourceItem = sender.getValue(this.bindingPath.$path.$getChild(index));
          const newItem = newSourceItem === undefined ? undefined
          : {
              sortKey: this.getSortKey === undefined ? undefined : this.getSortKey(newSourceItem),
              groups: this.groupings === undefined ? [] : this.groupings.map(grouping => grouping(newSourceItem)), 
              isVisible: this.filter === undefined ? true : this.filter(newSourceItem),
            };
          const currentItem = source.find(item => item.sourceIndex === index);
          if(currentItem === undefined || newItem === undefined){
            if(!(currentItem === undefined && newItem === undefined)){
              this.reset();
            }
          }
          else{
            if(currentItem.sortKey !== newItem.sortKey || !currentItem.groups.reduce<boolean>((acc, value, index) => acc && value === newItem.groups[index], true)){
              this.reset();
            }
            else{
              currentItem.item = newSourceItem;
              const currentIndex = source.findIndex(item => item.sourceIndex === index);
              const startIndex = this.bindingPath.$path.$toArray().length + 1;
              EventManager.valueChanged.call(this, {
                sourceKey: this.sourceKey,
                originalPath: $pathFrom([currentIndex, ...args.originalPath.$toArray().slice(startIndex)]),
                changes: args.changes.map(item => {
                  return {
                    path: $pathFrom([currentIndex, ...item.path.$toArray().slice(startIndex)]),
                    oldValue: item.oldValue,
                    newValue: item.newValue,
                  };
                }),
              });
            }
          }
        }

      }
      else if(args.originalPath.$contains(this.bindingPath.$path)){
        this.reset();
      }
    }
  } 
  dispose(){
    if(!isArray(this.initParam.source)){
      EventManager.sourceChanged.remove(this.sourceChangedHandler);
      EventManager.valueChanged.remove(this.valueChangedHandler);
    }
  }
}
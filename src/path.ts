import { isArray, isString } from "util";
import { isNumber } from "lodash";

const isNumberRegex = /^([1-9]\d*|0)$/;

type Cast<T, P> = T extends P ? T : P;

export type Path = {
  $toArray: () => PropertyKey[];
  $toString: () => string;
  $contains: (path: Path) => boolean;
  $equals: (path: Path) => boolean;
  $getChild: (key: PropertyKey) => Path;
  $getCurrentKey(): PropertyKey;
  $asTypedPath: <T>() => TypedPath<T>;
};

type TypedPathDummy<T> = {
  $dummy?: T
};
export type TypedPath<T> = (
  T extends Array<infer Z>
  ? {
      [index: number]: TypedPath<Z>;
      length: TypedPath<number>;
  }:
  {
    //readonly [K in keyof T]-?: TypedPath<T[K] extends infer A ? A : never>;
    readonly [K in keyof T]-?: TypedPath<T[K]>;
  }
)
& Path & TypedPathDummy<T> 


class PathImpl<T> implements Path{
  currentPath: PropertyKey[];
  constructor(currentPath: PropertyKey[]){
    this.currentPath = currentPath;
  }
  $toArray() {
    return this.currentPath;
  }
  $toString(){
    const pathString = this.currentPath.reduce<string>((current, next) => {
      if(isNumber(next)){
        return current + "[" + next.toString() + "]";
      }
      else{
        return current + "." + next.toString();
      }
    }, "");
    return pathString[0] === "." ? pathString.substring(1) : pathString;
  }
  $contains(path: Path) {
    const targetPath = path.$toArray();
    if(this.currentPath.length > targetPath.length){
      return false;
    }
    else{
      for(var i = 0;i < this.currentPath.length;i++){
        if(this.currentPath[i] !== targetPath[i]){
          return false;
        }
      }
      return true;
    }
  }
  $equals(path: Path): boolean{
    return this.$toString() === path.$toString();
  }
  $getChild (key: PropertyKey){
    const propertyName = (isString(key) && isNumberRegex.test(key)) ? Number(key) : key;
    return new PathImpl([...this.currentPath, propertyName]);
  }
  $getCurrentKey(){
    return this.currentPath[this.currentPath.length - 1];
  }
  $asTypedPath<T>() {
    return $pathFrom<T>(this.$toArray());
  }
}
function _path<T>(currentPath: PropertyKey[]): TypedPath<T>{
  return new Proxy(new PathImpl(currentPath) as any, {
    get: function<T>(target: T, name: PropertyKey, receiver: any): any {
      if(name in target){
        return Reflect.get(target as any, name, receiver);
      }
      else{
        const propertyName = (isString(name) && isNumberRegex.test(name)) ? Number(name) : name;
        return _path([...currentPath, propertyName]);
      }
    },
  }) as TypedPath<T>;
}



export function $path<T>(){
  return _path<T>([]);
}
export function $pathFrom<T>(path: string | PropertyKey[]){
  const pathArray = isArray(path) ? path : path.split(/[\.\[\]]/).filter(item => item.trim().length > 0).map(name => (isString(name) && isNumberRegex.test(name)) ? Number(name) : name);
  return _path<T>(pathArray);
}
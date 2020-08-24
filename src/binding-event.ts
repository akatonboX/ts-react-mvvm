import { SourceKey } from "./binding-common";
import { Path } from "./path";
import { Event } from "./event";
import { isArray } from "util";
import { ValidateError, InputRef } from "./binding-input";

export interface SourceChangedEventArgs{
  readonly sourceKey: SourceKey;
  readonly oldSource: any;
  readonly newSource: any;
}
  
export interface ValueChangingEventArgs{
  readonly sourceKey: SourceKey;
  readonly path: Path;
  readonly oldValue: any;
  readonly newValue: any;
  isCancel: boolean;
}
export interface ValueChangedEventArgs{
  readonly sourceKey: SourceKey;
  readonly originalPath: Path;
  readonly changes: ChangedValue[];
}
export interface ChangedValue{
  readonly path: Path;
  readonly oldValue: any;
  readonly newValue: any;
}
export interface InputChangedEventArgs{
  readonly id: symbol;
  readonly oldValue: any[];
  readonly newValue: any[];
}
export interface ErrorChangedEventArgs{
  readonly sourceKey: SourceKey;
  readonly path: Path;
  readonly oldValue: ValidateError[];
  readonly newValue: ValidateError[];
}
class _EventManager{
  readonly sourceChanged: Event<SourceChangedEventArgs> = new Event<SourceChangedEventArgs>();
  readonly valueChanged: Event<ValueChangedEventArgs> = new Event<ValueChangedEventArgs>();
  readonly inputChanged: Event<InputChangedEventArgs> = new Event<InputChangedEventArgs>();
  readonly ErrorChanged: Event<ErrorChangedEventArgs> = new Event<ErrorChangedEventArgs>();
}

export const EventManager = new _EventManager();

export function createValueChangedEventArgs(sourceKey: SourceKey, path: Path, oldValue: any, newValue: any): ValueChangedEventArgs{
  const changes = getChanges(path, oldValue, newValue, []);
  return {
    sourceKey: sourceKey,
    originalPath: path,
    changes: changes
  };
}

type ValueChanged = {
  readonly path: Path;
  readonly oldValue: any;
  readonly newValue: any;
};

function getChanges(path: Path, oldValue: any, newValue: any, changedPaths: ValueChanged[]): ValueChanged[]{
  if(oldValue === undefined && newValue === undefined){
    return changedPaths;
  }
  else if(isArray(oldValue) && isArray(newValue)){
    const result: ValueChanged[] = changedPaths;
    const length = oldValue.length > newValue.length ? oldValue.length : newValue.length;
    for(var i = 0; i < length; i++){
      const oldChildValue = i < oldValue.length ? oldValue[i] : undefined;
      const newChildValue = i < newValue.length ? newValue[i] : undefined;
      getChanges(path.$getChild(i), oldChildValue, newChildValue, changedPaths);
    }
    if(oldValue.length != newValue.length){
      result.push({
        path: path.$getChild("length"),
        oldValue: oldValue.length,
        newValue: newValue.length,
      });
    }
    return result;
  }
  else{
    const result: ValueChanged[] = changedPaths;
    if(oldValue !== newValue){
      result.push({
        path: path,
        oldValue: oldValue,
        newValue: newValue,
      });
    }
    if(isArray(oldValue)){
      result.push({
        path: path.$getChild("length"),
        oldValue: undefined,
        newValue: oldValue.length,
      });
      oldValue.forEach((item, index) => {
        result.push({
          path: path.$getChild(index),
          oldValue: item,
          newValue: undefined,
        });
      })
    }
    else if(isArray(newValue)){
      result.push({
        path: path.$getChild("length"),
        oldValue: undefined,
        newValue: newValue.length,
      });
      newValue.forEach((item, index) => {
        result.push({
          path: path.$getChild(index),
          oldValue: undefined,
          newValue: item,
        });
      })
    }
    return result;
  }
}
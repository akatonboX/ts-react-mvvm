import { BindingPath, InvalidType, SourceKey } from './binding-common';
import { SourceManager, ReadonlySourceProxy } from './binding-source';
import { EventManager } from './binding-event';

class InputManagerImpl {
  private inputs: InputRef[] = [];

  find(id: symbol): InputRef | undefined {
    return this.inputs.find((item) => item.id === id);
  }

  findByPath(bindingPath: BindingPath): InputRef[] {
    return this.inputs.filter((inputRef) => inputRef.bindingPath.$equals(bindingPath));
  }

  findBySourceKey(sourceKey: SourceKey): InputRef[] {
    return this.inputs.filter((inputRef) => inputRef.bindingPath.$sourceKey === sourceKey);
  }

  findByDependence(bindingPath: BindingPath): InputRef[] {
    return this.inputs.filter((inputRef) => inputRef.dependencePaths.find((path) => path.$equals(bindingPath)) !== undefined);
  }

  findByName(name: string): InputRef[] {
    return this.inputs.filter((inputRef) => inputRef.name === name);
  }

  regist(inputRef: InputRef) {
    if (this.find(inputRef.id) !== undefined) throw Error(`_InputManager.regist: id already exists. id=${String(inputRef.id)}`);
    this.inputs.push(inputRef);
  }

  remove(id: symbol): void{
    const inputRef = this.find(id);
    if (inputRef === undefined) throw new Error(`_InputManager.remove: id does not exist. id=${String(id)}`);

    this.inputs = this.inputs.filter((item) => item.id !== id);
    inputRef.dispose();
  }
}
export const InputManager = new InputManagerImpl();
if (process.env.NODE_ENV === 'development') (window as any).InputManager = InputManager;

export interface ValidateError{
  message: string;
  allowSet: boolean;
}

export class InputRef {
  readonly id: symbol;

  readonly name: string | undefined;

  readonly bindingPath: BindingPath;

  readonly defaultValue: any;

  readonly isEnable: boolean;

  readonly dependencePaths: BindingPath[];

  private _errors: ValidateError[] = [];

  private _value: any;

  validate: () => void = () => {
    // do nothing
  };

  convert: (value: any) => any = (value) => value;

  constructor(id: symbol, name: string | undefined, bindingPath: BindingPath, defaultValue: any, isEnable: boolean, dependencePaths?: BindingPath[]) {
    this.id = id;
    this.name = name;
    this.bindingPath = bindingPath;
    this._value = defaultValue;
    this.defaultValue = defaultValue;
    this.dependencePaths = dependencePaths === undefined ? [] : dependencePaths;
    this.isEnable = isEnable;
  }

  getValue() {
    return this._value;
  }

  setValue(value: any) {
    const newValue = value === undefined ? this.defaultValue : value;
    if (this._value !== newValue) {
      const oldValue = this._value;
      this._value = newValue;
      EventManager.inputChanged.call(this, {
        id: this.id,
        oldValue,
        newValue,
      });
    }
  }

  getError() {
    return this._errors;
  }

  setError(errors: ValidateError[]) {
    const oldErrors = this._errors;
    this._errors = errors;
    if (
      (oldErrors.length === 0 && errors.length > 0)
      || (oldErrors.length > 0 && errors.length === 0)
    ) {
      EventManager.ErrorChanged.call(this, {
        sourceKey: this.bindingPath.$sourceKey,
        path: this.bindingPath.$path,
        oldValue: oldErrors,
        newValue: errors,
      });
    }
  }

  reset() {
    const bindingSouce = SourceManager.find(this.bindingPath.$sourceKey);
    const initValue = bindingSouce === undefined ? undefined : bindingSouce.getValue(this.bindingPath.$path);
    const converted = this.convert(initValue);
    this.setValue(converted);
    if (this._errors.length > 0) {
      this.setError([]);
    }
  }

  dispose() {
    this._errors = [];
    this._value = undefined;
    this.validate = () => {
      // do nothing
    };
    this.convert = () => {
      // do nothing
    };
  }
}

export interface Input<T_INPUT_VALUE>{
  readonly id: symbol;
  readonly name: string | undefined;
  readonly inputValue: T_INPUT_VALUE;
  readonly isEnabled: boolean;
  onInputChange: (inputValue: T_INPUT_VALUE) => void;
  onValidation: () => void;
}

export type ValidateFunction<T_VALUE, T_INPUT_VALUE> = (input: T_INPUT_VALUE, proxy: ReadonlySourceProxy<T_VALUE>) => ValidateError | string | null;

export interface InputOption<T_VALUE, T_INPUT_VALUE>{
  name?: string;
  defaultValue: T_INPUT_VALUE;
  convertInputValue?: (input: T_INPUT_VALUE) => T_INPUT_VALUE;
  validates?: ValidateFunction<T_VALUE, T_INPUT_VALUE>[];
  isEnable?: boolean;
  convert?: (value: T_VALUE | undefined) => T_INPUT_VALUE;
  convertBack?: (input: T_INPUT_VALUE, currentValue?: T_VALUE) => T_VALUE | InvalidType;
}

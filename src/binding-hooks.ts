import React from 'react';
import { isArray, isString } from 'util';
import {
  SourceKey, BindingPath, Invalid, TypedBindingPath, isBindingPath,
} from './binding-common';
import {
  SourceProxy, ReadonlySourceProxy, SourceManager, BindingSource, CollectionSource, NormalBindingSource,
} from './binding-source';
import {
  ValueChangedEventArgs, ChangedValue, EventManager, SourceChangedEventArgs, ErrorChangedEventArgs, InputChangedEventArgs,
} from './binding-event';
import { BindingReceiver, isBinding, Binding } from './binding-receiver';
import {
  ValidateError, InputOption, Input, InputManager, InputRef,
} from './binding-input';

let getId = ((i) => () => i++)(1);
export function useId() {
  const idRef = React.useRef('');
  if (idRef.current.length === 0) {
    const idNumber = getId();
    if (idNumber + 1 === Number.MAX_VALUE) {
      getId = ((i) => () => i++)(1);
    }
    idRef.current = `ID_${idNumber}`;
  }
  return idRef.current;
}

function useRender() {
  const [version, setVersion] = React.useState(Number.MIN_VALUE);
  const componentState = React.useRef(false);

  React.useEffect(() => {
    componentState.current = true;
    return function cleanup() {
      componentState.current = false;
    };
  });

  return () => {
    if (componentState.current) setVersion(version === Number.MAX_VALUE ? Number.MIN_VALUE : version + 1);
  };
}

export function useBindingSource<T>(
  sourceKey: SourceKey,
  initialValue: T | Binding<T>,
  deps: React.DependencyList = [],
  onInitialized?: (proxy: SourceProxy<T>) => void,
  onValueChanged?: (proxy: SourceProxy<T>, changes: ChangedValue[]) => void,
): void {
  const receiver = useBindingReceiver();
  const source = isBinding(initialValue) ? initialValue.getValue(receiver) : initialValue;
  const deps2 = isBinding(initialValue) ? [...deps, source] : deps;
  React.useEffect(() => {
    const currentBindingSouce = SourceManager.find(sourceKey);
    const bindingSource = (
      () => {
        if (currentBindingSouce !== undefined) {
          currentBindingSouce.update(source);
          return currentBindingSouce;
        }

        const result = new NormalBindingSource(sourceKey, source);
        SourceManager.regist(result);
        return result;
      }
    )();

    if (onInitialized !== undefined) {
      onInitialized(bindingSource.createSourceProxy<T>());
    }

    const onValueChangedHandler = async (sender: BindingSource, args: ValueChangedEventArgs) => {
      if (onValueChanged !== undefined) {
        if (sender.sourceKey === sourceKey) {
          await onValueChanged(sender.createSourceProxy<T>(), args.changes);
        }
      }
    };
    EventManager.valueChanged.add(onValueChangedHandler);
    return function cleanup() {
      EventManager.valueChanged.remove(onValueChangedHandler);
    };
  }, deps2);

  React.useEffect(() => function cleanup() {
    SourceManager.remove(sourceKey);
  }, []);
}

export function useBindingReceiver(): BindingReceiver {
  const render = useRender();
  const receiver = new BindingReceiver();

  const sourceChangedHandler = async (sender: BindingSource, args: SourceChangedEventArgs) => {
    if (receiver.hasSource(args.sourceKey)) {
      render();
    }
  };
  const valueChangedHandler = async (sender: BindingSource, args: ValueChangedEventArgs) => {
    const needRender = args.changes.reduce((previouseValue, item) => {
      if (previouseValue) return true;

      return receiver.needRender(args.sourceKey, item.path, item.oldValue, item.newValue);
    }, false);

    if (needRender) {
      render();
    }
  };

  React.useEffect(() => {
    if (receiver.isOld()) {
      render();
    }
    EventManager.sourceChanged.add(sourceChangedHandler);
    EventManager.valueChanged.add(valueChangedHandler);
    return function cleanup() {
      EventManager.sourceChanged.remove(sourceChangedHandler);
      EventManager.valueChanged.remove(valueChangedHandler);
    };
  });

  return receiver;
}

export function useInput<T_VALUE, T_INPUT_VALUE>(
  source: TypedBindingPath<T_VALUE>,
  option: InputOption<T_VALUE, T_INPUT_VALUE>,
  dependencePaths?: BindingPath[],
): Input<T_INPUT_VALUE> {
  const render = useRender();

  const isEnable = option.isEnable === undefined ? true : option.isEnable;

  const convertInputValue = option.convertInputValue === undefined ? (inputValue: T_INPUT_VALUE) => inputValue : option.convertInputValue;
  const convertBack = option.convertBack === undefined ? (inputValue: T_INPUT_VALUE, currentValue: T_VALUE) => inputValue as any as T_VALUE : option.convertBack;
  const validates = option.validates === undefined ? [] : option.validates;

  const initParameters = React.useRef({
    id: Symbol(option.name !== undefined ? option.name : `${String(source.$sourceKey)}:${source.$path.$toString()}`),
  });
  const { id } = initParameters.current;

  const currentInputRef = InputManager.find(id);
  const bindingSource = SourceManager.find(source.$sourceKey);
  const bindingSourceVersion = bindingSource === undefined ? undefined : bindingSource.version;
  const currentInputValue = (() => {
    if (currentInputRef !== undefined) {
      return currentInputRef.getValue() as T_INPUT_VALUE;
    }

    const sourceValue = bindingSource === undefined ? undefined : bindingSource.getValue(source.$path);
    const convertedValue = sourceValue === undefined ? undefined : option.convert !== undefined ? option.convert(sourceValue) : sourceValue as T_INPUT_VALUE;
    return convertedValue !== undefined ? convertedValue : option.defaultValue;
  })();

  const currentInput: Input<T_INPUT_VALUE> = {
    id,
    name: option.name,
    inputValue: currentInputValue,
    isEnabled: isEnable,
    onInputChange: isEnable ? (inputValue) => {
      const input = InputManager.find(id);
      if (input === undefined) throw Error(`Input.onInputChange: id not found. id=${String(id)}, name=${option.name}`);

      const converted = convertInputValue(inputValue);
      input.setValue(converted);
      input.validate();
      if (input.getError().filter((error) => !error.allowSet).length === 0) {
        const bindingSource2 = SourceManager.find(source.$sourceKey);
        if (bindingSource2 !== undefined) {
          const oldValue = bindingSource2.getValue(source.$path);
          const newValue = convertBack(converted, oldValue);
          if (newValue !== Invalid && oldValue !== newValue) {
            bindingSource2.setValue(source.$path, newValue);
          }
        }
      }
    } : (inputValue) => {
      // do nothing
    },
    onValidation: isEnable ? () => {
      const input = InputManager.find(id);
      if (input === undefined) throw Error(`Input.onValidation: id not found. id=${String(id)}, name=${option.name}`);
      input.validate();
    } : () => {
      // do nothing
    },
  };

  const inputRef = currentInputRef !== undefined ? currentInputRef : new InputRef(id, option.name, source, option.defaultValue, isEnable, dependencePaths);
  inputRef.validate = isEnable ? () => {
    const bindingSource2 = SourceManager.find(source.$sourceKey);
    if (bindingSource2 !== undefined) {
      const currentValue = bindingSource2.getValue(source.$path);
      const errors = validates
        .map((validate) => validate(inputRef.getValue(), new ReadonlySourceProxy(source.$sourceKey, source.$path)))
        .filter((item): item is string | ValidateError => item !== null)
        .map((error) => (isString(error) ? { message: error, allowSet: false } : error));
      inputRef.setError(errors);
    }
  } : () => {
    // do nothing
  };
  inputRef.convert = option.convert === undefined ? (value) => value : option.convert;

  const inputChangedHandler = (sender: BindingSource, args: InputChangedEventArgs) => {
    if (id === args.id) {
      render();
    }
  };

  React.useEffect(() => {
    EventManager.inputChanged.add(inputChangedHandler);
    return function cleanup() {
      EventManager.inputChanged.remove(inputChangedHandler);
    };
  });

  React.useEffect(() => {
    InputManager.regist(inputRef);
    const currentBindingSource = SourceManager.find(source.$sourceKey);
    if (bindingSourceVersion !== currentBindingSource?.version) {
      inputRef.reset();
      render();
    }
    return function cleanup() {
      InputManager.remove(id);
    };
  }, []);

  return currentInput;
}

export function useValidateErrors(target: BindingPath | string | symbol): ValidateError[] {
  const render = useRender();
  const currentInputRefs = (() => {
    if (isBindingPath(target)) {
      return InputManager.findByPath(target);
    }
    if (isString(target)) {
      return InputManager.findByName(target);
    }

    const input = InputManager.find(target);
    return input === undefined ? [] : [input];
  })();

  const onErrorChanged = async (sender: any, args: ErrorChangedEventArgs) => {
    const inputRefs = (() => {
      if (isBindingPath(target)) {
        return InputManager.findByPath(target);
      }
      if (isString(target)) {
        return InputManager.findByName(target);
      }

      const input = InputManager.find(target);
      return input === undefined ? [] : [input];
    })();
    const bindingPaths = inputRefs.map((inputRef) => inputRef.bindingPath);
    if (bindingPaths.find((bindingPath) => bindingPath.$sourceKey === args.sourceKey && bindingPath.$path.$equals(args.path)) !== undefined) {
      render();
    }
  };

  React.useEffect(() => {
    EventManager.ErrorChanged.add(onErrorChanged);
    return function cleanup() {
      EventManager.ErrorChanged.remove(onErrorChanged);
    };
  });

  return currentInputRefs.reduce((previousValue, inputRef) => [...previousValue, ...inputRef.getError()], [] as ValidateError[]);
}

export function useCollectionSource<T>(
  sourceKey: SourceKey,
  source: Binding<T[]> | T[],
  getSortKey?: (item1: T) => any,
  groupings?: ((item: T) => string)[],
  filter?: (item1: T) => boolean,
  deps: React.DependencyList = [],
): void {
  const receiver = useBindingReceiver();
  const items = isArray(source) ? source : source.getValue(receiver);
  React.useEffect(() => {
    const currentBindingSouce = SourceManager.find(sourceKey);
    if (currentBindingSouce === undefined) {
      const bindingSource = new CollectionSource(sourceKey, {
        source: isArray(source) || source.bindingPath === undefined || source.hasConverter || source.hasDefaultValue ? items === undefined ? [] : items : source.bindingPath,
        getSortKey,
        groupings,
        filter,
      });
      SourceManager.regist(bindingSource);
    } else {
      currentBindingSouce.update(
        {
          source: isArray(source) || source.bindingPath === undefined || source.hasConverter || source.hasDefaultValue ? items === undefined ? [] : items : source.bindingPath,
          getSortKey,
          groupings,
          filter,
        },
      );
    }
  }, deps);

  React.useEffect(() => function cleanup() {
    SourceManager.remove(sourceKey);
  }, []);
}

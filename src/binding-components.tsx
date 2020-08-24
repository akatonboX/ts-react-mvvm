import * as React from 'react';
import { SourceKey, BindingPath, InvalidType, Invalid, TypedBindingPath, $bindingPath} from "./binding-common";
import { SourceProxy, } from "./binding-source";
import { useBindingSource, useBindingReceiver, useValidateErrors, useInput, useCollectionSource } from "./binding-hooks";
import { ChangedValue } from './binding-event';
import { $path } from './path';
import { Binding } from './binding-receiver';
import { ValidateError, ValidateFunction, Input } from './binding-input';
import { isString, isObject } from 'util';
import { Tooltip } from './tooltip';


export function BindSource<T>(
  props: {
    sourceKey: SourceKey,
    initialValue: T | Binding<T>,
    deps?: React.DependencyList,
    onInitialized?: (proxy: SourceProxy<T>) => void,
    onValueChanged?: (proxy: SourceProxy<T>, changes: ChangedValue[]) =>  void,
    children?: never,
  }
): JSX.Element
{
  useBindingSource(props.sourceKey, props.initialValue, props.deps, props.onInitialized, props.onValueChanged);
  return <></>;
}
  
function BindDefaultTemplate<T> (props: {[K in keyof T]-?: T[K] | undefined}): JSX.Element
{
  const values: any[] = [];
  for (const name in props){
    values.push(props[name]);
  }
  return(
    <>
      {
        values.map(value => value)
      }
    </>
  );
}

export function Bind<T>(
  props: {
    bindings: {
      [K in keyof T]-?: Binding<T[K]>
    };
    children?: (props: {[K in keyof T]-?: T[K] | undefined}) => JSX.Element;
  }
): JSX.Element
{
  const receiver = useBindingReceiver();
  const templateProps: any = {};
  for (const name in props.bindings){
    const binding = props.bindings[name];
    templateProps[name] = binding.getValue(receiver);
  }
  
  const Template = props.children !== undefined ? props.children : BindDefaultTemplate;
  return <Template {...templateProps} />;
  
}


function InputErrorDefaultTemplate(
  props: {
    errors: ValidateError[],
  }
): JSX.Element{
  
  return (
    <div style={{position: "absolute", marginLeft: -20, display: "inline-block"}}>
      <Tooltip
        backgroundColor="blue"
        textColor="white"
        content={props.errors.map((error, index) => <span key={index}>{error.message}<br /></span>)}
      >
        <svg width="20" height="20" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="23" stroke="black" fill="red" strokeWidth={0} />
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="yellow" fontSize={45}>!</text>
        </svg>
      </Tooltip>
    </div>
  );
}

export function InputError(
  props: {
    target: string | symbol | BindingPath;
    children?: (props: {
      errors: ValidateError[];
    }) => JSX.Element;
  }
): JSX.Element{
  const errors = useValidateErrors(props.target);
  const Template = props.children === undefined ? InputErrorDefaultTemplate : props.children;
  return (
    <>
      {
        errors.length > 0 ?
          <Template errors={errors} />  
          : <></>
      }
    </>
  );
}

function DefaultTemplate(props: {children: JSX.Element}): JSX.Element{
  return props.children;
}

export interface InputSource<T_VALUE>{
  value: T_VALUE;
}

function BindInputCore<T_INPUT = string, T_VALUE = T_INPUT>(
  props: {
    name?: string,
    defaultValue: T_INPUT,
    source: TypedBindingPath<T_VALUE>,
    convertInputValue?: (input: T_INPUT) => T_INPUT;
    validates?: ValidateFunction<T_VALUE, T_INPUT>[];
    isEnable?: boolean;
    convert?: (value: T_VALUE | undefined) => T_INPUT;
    convertBack?: (input: T_INPUT, currentValue?: T_VALUE) => T_VALUE | InvalidType;
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
    children: (props: Input<T_INPUT>) => JSX.Element,
  }
): JSX.Element{
  const input = useInput(props.source,{
    name: props.name,
    defaultValue: props.defaultValue,
    convertInputValue: props.convertInputValue,
    validates:  props.validates,
    isEnable: props.isEnable,
    convert: props.convert,
    convertBack: props.convertBack,
  }, props.dependencePaths);
  const Template = props.template === undefined ? DefaultTemplate : props.template;
  return  <Template>{props.children(input)}</Template>
}

function BindInputWithDataSource<T_INPUT = string, T_VALUE = T_INPUT>(
  props: {
    name: string,
    defaultValue: T_INPUT,
    convertInputValue?: (input: T_INPUT) => T_INPUT;
    validates?: ValidateFunction<T_VALUE, T_INPUT>[];
    isEnable?: boolean;
    convert?: (value: T_VALUE | undefined) => T_INPUT;
    convertBack?: (input: T_INPUT, currentValue?: T_VALUE) => T_VALUE | InvalidType;
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
    children: (props: Input<T_INPUT>) => JSX.Element,
  }
): JSX.Element{

  const convertedDefaultValue = props.convertBack !== undefined ? props.convertBack(props.defaultValue) : undefined;
  useBindingSource<InputSource<T_VALUE>>(props.name, {
    value: convertedDefaultValue === undefined || convertedDefaultValue === Invalid ? props.defaultValue as any as T_VALUE : convertedDefaultValue,
  })

  return <BindInputCore {...props} source={$bindingPath(props.name, $path<InputSource<T_VALUE>>().value)}/>; 
}

export function BindInput<T_INPUT = string, T_VALUE = T_INPUT>(
  props: {
    name?: string,
    defaultValue: T_INPUT,
    source?: TypedBindingPath<T_VALUE>,
    convertInputValue?: (input: T_INPUT) => T_INPUT;
    validates?: ValidateFunction<T_VALUE, T_INPUT>[];
    isEnable?: boolean;
    convert?: (value: T_VALUE | undefined) => T_INPUT;
    convertBack?: (input: T_INPUT, currentValue?: T_VALUE) => T_VALUE | InvalidType;
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
    children: (props: Input<T_INPUT>) => JSX.Element,
  }
): JSX.Element{

  if(props.source === undefined){
    if(props.name === undefined)
      throw Error("<BindInput/>: Either name or bindingPath is required.");
    return <BindInputWithDataSource {...props} name={props.name} />;
  }
  else{
    return <BindInputCore {...props} source={props.source}/>;
  }
  
}

export function BindTextBox<T_VALUE = string>(
  props: {
    name?: string,
    defaultValue?: string,
    source?: TypedBindingPath<T_VALUE>,
    convertInputValue?: (input: string) => string;
    validates?: ValidateFunction<T_VALUE, string>[],
    isEnable?: boolean,
    convert?: (value: T_VALUE | undefined) => string,
    convertBack?: (input: string, currentValue?: T_VALUE) => T_VALUE,
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
  } & React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
): JSX.Element{
  const inputProps = Object.assign({}, props);
  delete inputProps.source;
  delete inputProps.defaultValue;
  delete inputProps.convertInputValue;
  delete inputProps.validates;
  delete inputProps.isEnable;
  delete inputProps.convert;
  delete inputProps.convertBack;
  delete inputProps.dependencePaths;
  delete inputProps.template;
  if(inputProps.disabled === undefined){
    inputProps.disabled = props.isEnable === undefined ? false : !props.isEnable;
  }

  const convert = (value: T_VALUE | undefined) => {
    const converted = props.convert === undefined ? value : props.convert(value);
    return converted === undefined ? "" : isString(converted) ? converted : "";
  }

  return (
    <BindInput<string, T_VALUE>
      name={props.name}
      defaultValue={props.defaultValue === undefined ? "" : props.defaultValue}
      source={props.source}
      convertInputValue={props.convertInputValue}
      validates={props.validates}
      isEnable={props.isEnable}
      convert={convert}
      convertBack={props.convertBack}
      dependencePaths={props.dependencePaths}
      template={props.template}
    >
      {
        childProps => {
          return (
            <input 
              {...inputProps} 
              onChange={event => {childProps.onInputChange(event.target.value);}}  
              onBlur={event => {childProps.onValidation();}}
              value={childProps.inputValue === undefined ? "" : childProps.inputValue}
            />
          );
        }
      }
    </BindInput>
  );
}
export function BindTextArea<T_VALUE = string>(
  props: {
    name?: string,
    defaultValue?: string,
    source?: TypedBindingPath<T_VALUE>,
    convertInputValue?: (input: string) => string;
    validates?: ValidateFunction<T_VALUE, string>[],
    isEnable?: boolean,
    convert?: (value: T_VALUE | undefined) => string,
    convertBack?: (input: string, currentValue?: T_VALUE) => T_VALUE,
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
  } & React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>
): JSX.Element{
  const inputProps = Object.assign({}, props);
  delete inputProps.source;
  delete inputProps.defaultValue;
  delete inputProps.convertInputValue;
  delete inputProps.validates;
  delete inputProps.isEnable;
  delete inputProps.convert;
  delete inputProps.convertBack;
  delete inputProps.dependencePaths;
  delete inputProps.template;
  if(inputProps.disabled === undefined){
    inputProps.disabled = props.isEnable === undefined ? false : !props.isEnable;
  }
  const convert = (value: T_VALUE | undefined) => {
    const converted = props.convert === undefined ? value : props.convert(value);
    return converted === undefined ? "" : isString(converted) ? converted : "";
  }

  return (
    <BindInput<string, T_VALUE>
      name={props.name}
      defaultValue={props.defaultValue === undefined ? "" : props.defaultValue}
      source={props.source}
      convertInputValue={props.convertInputValue}
      validates={props.validates}
      isEnable={props.isEnable}
      convert={convert}
      convertBack={props.convertBack}
      dependencePaths={props.dependencePaths}
      template={props.template}
    >
      {
        childProps => {
          return (
            <textarea 
              {...inputProps} 
              onChange={event => {childProps.onInputChange(event.target.value);}}  
              onBlur={event => {childProps.onValidation();}}
              value={childProps.inputValue === undefined ? "" : childProps.inputValue}
            />
          );
        }
      }
    </BindInput>
  );
}
export function BindSelectButton<T_VALUE>(
  props: {
    name?: string,
    defaultValue?: boolean,
    source?: TypedBindingPath<T_VALUE>,
    validates?: ValidateFunction<T_VALUE, boolean>[];
    isEnable?: boolean;
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
    children: (props: Input<boolean>) => JSX.Element,
    equals?: (target: T_VALUE, value: T_VALUE) => boolean,
    targetValue: T_VALUE,
    noneValue?: T_VALUE,
  }
): JSX.Element{
  const equals = (target: T_VALUE | undefined, value: T_VALUE | undefined) => {
    if(target !== undefined && value !== undefined){
      return props.equals === undefined ? target === value : props.equals(target, value);
    }
    else if(target === undefined && value !== undefined)
      return false;
    else if(target !== undefined && value === undefined)
      return false;
    else
      return true;
  } 

  return (
    <BindInput<boolean, T_VALUE>
      name={props.name}
      defaultValue={props.defaultValue === undefined ? false : props.defaultValue}
      source={props.source}
      validates={props.validates}
      isEnable={props.isEnable}
      convert={(value: T_VALUE | undefined) => equals(props.targetValue, value) ? true : false}
      convertBack={(input: boolean) => input === true ? props.targetValue : props.noneValue as T_VALUE}
      dependencePaths={props.dependencePaths}
      template={props.template}
      children={props.children}
    />
  );
}

export function BindRadioButton<T_VALUE>(
  props: {
    name?: string,
    defaultValue?: boolean,
    source?: TypedBindingPath<T_VALUE>,
    validates?: ValidateFunction<T_VALUE, boolean>[];
    isEnable?: boolean;
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
    equals?: (target: T_VALUE, value: T_VALUE) => boolean,
    targetValue: T_VALUE,
  } & React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
): JSX.Element{
  const inputProps = Object.assign({}, props);
  delete inputProps.defaultValue;
  delete inputProps.source;
  delete inputProps.validates;
  delete inputProps.isEnable;
  delete inputProps.dependencePaths;
  delete inputProps.template;
  delete inputProps.equals;
  delete inputProps.targetValue;
  inputProps.type = "radio";
  if(inputProps.disabled === undefined){
    inputProps.disabled = props.isEnable === undefined ? false : !props.isEnable;
  }
  return (
    <BindSelectButton
      name={props.name}
      defaultValue={props.defaultValue}
      source={props.source}
      validates={props.validates}
      isEnable={props.isEnable}
      dependencePaths={props.dependencePaths}
      template={props.template}
      equals={props.equals}
      targetValue={props.targetValue}
    >
      {
        childProps => {
          return (
            <input 
              {...inputProps}  
              onChange={event => {childProps.onInputChange(event.target.checked);}}  
              checked={childProps.inputValue === undefined ? false : childProps.inputValue}
            />
          );
        }
      }
    </BindSelectButton>
  );
}
export function BindMultiSelectButton<T_VALUE>(
  props: {
    name?: string,
    defaultValue?: boolean,
    source?: TypedBindingPath<T_VALUE[]>,
    validates?: ValidateFunction<T_VALUE[], boolean>[];
    isEnable?: boolean;
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
    children: (props: Input<boolean>) => JSX.Element,
    equals?: (target: T_VALUE, value: T_VALUE) => boolean,
    targetValue: T_VALUE,
  }
): JSX.Element{
  const equals = (target: T_VALUE | undefined, value: T_VALUE | undefined) => {
    if(target !== undefined && value !== undefined){
      return props.equals === undefined ? target === value : props.equals(target, value);
    }
    else if(target === undefined && value !== undefined)
      return false;
    else if(target !== undefined && value === undefined)
      return false;
    else
      return true;
  } 

  return (
    <BindInput<boolean, T_VALUE[]>
      name={props.name}
      defaultValue={props.defaultValue === undefined ? false : props.defaultValue}
      source={props.source}
      validates={props.validates}
      isEnable={props.isEnable}
      convert={(value: T_VALUE[] | undefined) => value === undefined ? false : value.find(item => equals(props.targetValue, item)) !== undefined}
      convertBack={(input, currentValue) => {
        const currentItems = (currentValue === undefined ? [] : currentValue).filter(item => !equals(item, props.targetValue));
        const result = input === true ? [...currentItems, props.targetValue] : currentItems;
        return result;
      }}
      dependencePaths={props.dependencePaths}
      template={props.template}
      children={props.children}
    />
  );
}
export function BindToggleButton(
  props: {
    name?: string,
    defaultValue?: boolean,
    source?: TypedBindingPath<boolean>,
    validates?: ValidateFunction<boolean, boolean>[];
    isEnable?: boolean;
    isReverse?: boolean;
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
    children: (props: Input<boolean>) => JSX.Element,
  }
): JSX.Element{
  const convert = (value: boolean | undefined) => {
    const v = value === undefined ? false : value;
    return props.isReverse === true ? !v : v;
  }
  const convertBack = (input: boolean) => {
    return props.isReverse === true ? !input : input;
  }
  return (
    <BindInput<boolean, boolean>
      name={props.name}
      defaultValue={props.defaultValue === undefined ? false : props.defaultValue}
      source={props.source}
      validates={props.validates}
      isEnable={props.isEnable}
      convert={convert}
      convertBack={convertBack}
      dependencePaths={props.dependencePaths}
      template={props.template}
      children={props.children}
    />
  );
}

export function BindCheckBox(
  props: {
    name?: string,
    defaultValue?: boolean,
    source?: TypedBindingPath<boolean>;
    validates?: ValidateFunction<boolean, boolean>[];
    isEnable?: boolean;
    isReverse?: boolean;
    dependencePaths?: BindingPath[];
    template?: (props: {children: JSX.Element}) => JSX.Element,
  } & React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
): JSX.Element{
  const inputProps = Object.assign({}, props);
  delete inputProps.defaultValue;
  delete inputProps.source;
  delete inputProps.validates;
  delete inputProps.isEnable;
  delete inputProps.dependencePaths;
  delete inputProps.template;
  inputProps.type = "checkbox";
  if(inputProps.disabled === undefined){
    inputProps.disabled = props.isEnable === undefined ? false : !props.isEnable;
  }
  return (
    <BindToggleButton
      source={props.source}
      validates={props.validates}
      isEnable={props.isEnable}
      isReverse={props.isReverse}
      dependencePaths={props.dependencePaths}
      template={props.template}
    >
      {
        childProps => {
          return (
            <>
              <input
                {...inputProps}  
                onChange={event => {childProps.onInputChange(event.target.checked);}} 
                onBlur={event => {childProps.onValidation();}}  
                checked={childProps.inputValue}
              />
            </>
          );
        }
      }
    </BindToggleButton>
  );
}

function BindListItemTemplateDefault<T>(
  props: {
    item: T,
  }
): JSX.Element
{
  if(isObject(props.item)){
    return <>{JSON.stringify(props.item)}</>;
  }
  else{
    return <>{String(props.item)}</>;
  }
}

function BindListItemWithBindingPath<T>(
  props: {
    item: TypedBindingPath<T>,
    template?: (props: {item: T}) => JSX.Element,
  }
): JSX.Element
{
  
  const receiver = useBindingReceiver();
  const item = receiver.get(props.item);
  const Template = props.template !== undefined ? props.template : BindListItemTemplateDefault;
  if(item === undefined){
    return <></>;
  }
  else{
    return <Template item={item} />;
  }
}

function BindListItemsWithBindingPath<T>(
  props: {
    items: TypedBindingPath<T[]>,
    itemTemplate?: (props: {item: T}) => JSX.Element,
    start: number;
    count: number;
  }
): JSX.Element
{
  const receiver = useBindingReceiver();
  const items = receiver.getOnly(props.items);
  receiver.registRenderCondition(props.items.$sourceKey, (bindingSource, path, oldValue, newValue) => {

    if(bindingSource.sourceKey === props.items.$sourceKey){
      if(props.items.$path.$getChild("length").$equals(path)){
        if(oldValue === undefined && newValue === undefined){
          return false;
        }
        else if(oldValue === undefined && newValue !== undefined){
          return true;
        }
        else if(oldValue !== undefined && newValue === undefined){
          return true;
        }
        else if(oldValue <= props.start && newValue > props.start){
          return true;
        }
        if(oldValue > props.start && newValue <= props.start){
          return true;
        }
      }
    }
    return false;
  });
  if(items !== undefined && items.length > props.start){
    const children: number[] = [];
    for(var i = props.start; i < props.start + props.count; i++){
      children.push(i);
    }
    return (
      <>
        {
          children.map(index => 
            <BindListItemWithBindingPath
              key={index}
              item={props.items.$getChild<T>(index)}
              template={props.itemTemplate}
              
            />)
        }
        <BindListItemsWithBindingPath
          items={props.items}
          itemTemplate={props.itemTemplate}
          start={props.start + props.count}
          count={props.count}
        />
      </>
    );
  }
  else{
    return <></>;
  }
}
function BindListItems<T>(
  props: {
    items: T[] | undefined,
    itemTemplate?: (props: {item: T}) => JSX.Element,
  }
): JSX.Element
{
  const Template = props.itemTemplate !== undefined ? props.itemTemplate : BindListItemTemplateDefault;
  if(props.items !== undefined ){
    return (
      <>
        {
          props.items.map((item, index) => <Template item={item} key={index} />)
        }
      </>
    );
  }
  else{
    return <></>;
  }
}
function BindListItemsWithCalc<T>(
  props: {
    items: Binding<T[]>,
    itemTemplate?: (props: {item: T}) => JSX.Element,
  }
): JSX.Element
{
  const receiver = useBindingReceiver();
  const items = props.items.getValue(receiver);
  const Template = props.itemTemplate !== undefined ? props.itemTemplate : BindListItemTemplateDefault;
  if(items !== undefined ){
    return (
      <>
        {
          items.map((item, index) => <Template item={item} key={index} />)
        }
      </>
    );
  }
  else{
    return <></>;
  }
}

export function BindList<T>(
  props: {
    //items: TypedBindingPath<T[]> | T[],
    items: Binding<T[]> | T[]
    template?: (props: {content: () => JSX.Element}) => JSX.Element,
    itemTemplate?: (props: {item: T}) => JSX.Element,
  }
): JSX.Element
{

  const Template = props.template !== undefined ? props.template
    :  (props: {content: () => JSX.Element}) => <props.content />;

  
  const content = (
    () => {
      if(Array.isArray(props.items)){
        return <BindListItems items={props.items} itemTemplate={props.itemTemplate} />;
      }
      else if(props.items.hasConverter || props.items.hasDefaultValue){
        return <BindListItemsWithCalc items={props.items} itemTemplate={props.itemTemplate} />
      }
      else if(props.items.bindingPath !== undefined){
        return <BindListItemsWithBindingPath items={props.items.bindingPath} itemTemplate={props.itemTemplate} start={0} count={100} />;
      }
      else{
        throw Error("BindList: not supoorted value of props.items.");
      }
    }
  )()
  return (
    <Template content={() => content} />
  );

}

export function BindCollectionSource<T>(
  props: {
    sourceKey: SourceKey,
    source: Binding<T[]> | T[],
    getSortKey?: (item1: T) => any,
    groupings?: ((item: T) => string)[],
    filter?: (item1: T) => boolean,
    deps?: React.DependencyList,
    children?: React.ReactNode,
  }
): JSX.Element
{
  useCollectionSource(props.sourceKey, props.source, props.getSortKey, props.groupings, props.filter, props.deps);
  return <>{props.children}</>;
}


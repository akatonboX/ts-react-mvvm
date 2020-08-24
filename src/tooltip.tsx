import React from 'react';
import styles from "./tooltip.module.scss";
import { classes } from "./common";
import { isNull } from 'util';
import { Property } from "csstype";

export function Tooltip(
  props: {
    content?: React.ReactNode | React.ReactNode[],
    backgroundColor?: Property.BackgroundColor;
    textColor?: Property.Color;
    children?: React.ReactNode | React.ReactNode[],
  }
): JSX.Element{
  const tooltipElementRef = React.useRef<HTMLSpanElement>(null);
  const myElementRef = React.useRef<HTMLDivElement>(null);
  const backgroundColor = props.backgroundColor === undefined ? Tooltip.Default.backgroundColor: props.backgroundColor;
  const textColor = props.textColor === undefined ? Tooltip.Default.textColor: props.textColor;

  const onTargetClick = (event: React.MouseEvent<HTMLSpanElement, MouseEvent>): void => {
    const tooltipElement = tooltipElementRef.current;
    if(isNull(tooltipElement))
      throw Error("");
    if(tooltipElement.style.visibility === "collapse"){
      const tooltipRect = tooltipElement.getBoundingClientRect();
      const targetRect = event.currentTarget.getBoundingClientRect();
      const idealMarginLeft = (tooltipRect.width / 2) - (targetRect.width / 2);
      const tooltipStyle = (
        () => {
          if(tooltipRect.left - idealMarginLeft < 0){
            tooltipElement.style.marginLeft = `${targetRect.width + 8}px`;
            tooltipElement.style.marginTop = `-${(tooltipRect.height / 2) - (targetRect.height / 2)}px`;
            return styles.right;
          }
          else if(tooltipRect.left - idealMarginLeft + tooltipRect.width > window.innerWidth){
            tooltipElement.style.marginLeft = `-${tooltipRect.width + 8}px`;
            tooltipElement.style.marginTop = `-${(tooltipRect.height / 2) - (targetRect.height / 2)}px`;
            return styles.left;
          }
          else{
            tooltipElement.style.marginLeft = `-${idealMarginLeft}px`;
            const idealMarginTop = tooltipRect.height;
            if(tooltipRect.top - idealMarginTop < 0){
              tooltipElement.style.marginTop = `${targetRect.height}px`;
              return styles.bottom;
            }
            else{
              tooltipElement.style.marginTop = `${idealMarginTop * -1}px`;
              return styles.top;
            }
          }
        }
      )();
      tooltipElement.className = classes(styles.tooltip, tooltipStyle);
      tooltipElement.style.visibility = "visible";
    }
    else{
      tooltipElement.style.marginLeft = "";
      tooltipElement.style.marginTop = "";
      tooltipElement.style.visibility = "collapse";
    }

  }
  const onWidnowClick = (event: MouseEvent): void => {
    if(!isNull(myElementRef.current) && !isNull(tooltipElementRef.current)){
      if(!myElementRef.current.contains(event.target as Node)){
        const tooltipElement = tooltipElementRef.current;
        tooltipElement.style.marginLeft = "";
        tooltipElement.style.marginTop = "";
        tooltipElement.style.visibility = "collapse";
      }
    }
  };


  React.useEffect(() => {
    window.addEventListener("click", onWidnowClick, true);
    return function cleanup() {
      window.removeEventListener("click", onWidnowClick, true);
    };
  });
  
  return (
    props.content === undefined
    ? <></>
    : 
      <div ref={myElementRef} className={styles.container}>
        <span ref={tooltipElementRef} style={{color: textColor,backgroundColor: backgroundColor, borderColor: backgroundColor, visibility:"collapse" }} className={classes(styles.tooltip)}>
          {props.content}
        </span>
        <div className={styles.target} onClick={onTargetClick}>
          {props.children}
        </div>
      </div>   
      
  );
}

Tooltip.Default = {
  backgroundColor: "" as Property.BackgroundColor,
  textColor: "" as Property.Color,
};
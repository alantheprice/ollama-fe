export interface Component<T> {
    (props: T): (parent?: HTMLElement | Element) => ElementRef;
  }
  
  export interface ElementRef<T = any> {
    current: HTMLElement | null | undefined;
    update: (data: T) => void;
    setChildren: (children: Children) => void;
    remove: () => void;
  }

  export interface ElementDefinedRef<T = any> extends ElementRef<T> {
    current: HTMLElement;
  }
  
  export type Children =
    | (((parent?: HTMLElement | Element) => ElementRef) | UElement | string)[];
  
  export interface ElementConfig<T = any> {
    [key: string]: any;
    onUpdate?: (data: T, ref: ElementDefinedRef) => void | boolean;
    onAttach?: (ref: ElementDefinedRef) => void;
    ref?: ElementRef;
  }
  
  export type UElement = <T = any>(
    elementConfig: ElementConfig<T>,
    children?: Children
  ) => (parent?: HTMLElement | Element) => ElementRef;
  
  export interface UElementDictionary {
    [key: string]: UElement;
  }
  
  const virtualProps = ["onAttach", "onUpdate"];
  const attributeList = "textContent|innerText|innerHTML|className|value|style|checked|selected|src|srcdoc|srcset|tabindex|target".split("|").reduce((result, attribute) => ((result[attribute] = 1), result), {});
  
  const isObj = (val: any) => typeof val === "object" && val !== null;
  const isFunc = (val: any) => typeof val === "function";
  
  const handleChildren = (
    children: Children,
    element: HTMLElement,
    childElements: ElementRef[],
    document: Document
  ) => {
    children.forEach((child: any) => {
      if (typeof child === "string") {
        const textNode = document.createTextNode(child);
        element.appendChild(textNode);
      } else if (isFunc(child)) {
        childElements.push(child(element));
      }
    });
  };
  
  const createElement = (namespace: string, document: Document) => (elementName: string) => (attributes: ElementConfig, children?: Children) => {
    const eventListeners: (() => void)[] = [];
    let ref = {} as ElementRef;
    const element = document.createElementNS(namespace, elementName);
    const childElements: ElementRef[] = [];
  
    const update = (data: any) => {
      if (attributes.onUpdate && !attributes.onUpdate(data, ref as ElementDefinedRef)) {
        return;
      }
  
      childElements.forEach((child: any) => {
        if (child.update && isFunc(child.update)) {
          child.update(data);
        }
      });
    };
    const remove = () => {
      eventListeners.forEach((remover) => remover());
      element.remove();
      childElements.forEach((child) => {
        child.remove();
      });
    };
  
    const setChildren = (newChildren: Children) => {
      childElements.forEach((child) => {
        child.remove();
      });
      handleChildren(newChildren, element as HTMLElement, childElements, document);
    };
  
    ref = { current: element as HTMLElement, update, setChildren, remove };
  
    Object.entries(attributes || {}).forEach((entry) => {
      const [attributeName, attributeValue] = entry;
      if (attributeName === "style" && isObj(attributeValue)) {
        Object.entries(attributeValue).forEach(
          ([styleName, styleValue]) => {
            // @ts-ignore
            element.style[styleName] = styleValue;
          }
        );
      } else if (virtualProps.includes(attributeName)) {
      } else if (attributeName === "ref" && isObj(attributeValue)) {
        Object.assign(attributeValue, ref);
      } else if (attributeName.indexOf("on") === 0) {
        const eventName = attributeName.slice(2).toLowerCase();
        element.addEventListener(eventName, attributeValue);
        eventListeners.push(() =>
          element.removeEventListener(eventName, attributeValue)
        );
      } else {
        attributeList[attributeName] || "boolean" == typeof attributeValue
          ? (element[attributeName] = attributeValue)
          : element.setAttribute(attributeName, attributeValue);
      }
    });
    return (parent: null | undefined | HTMLElement | Element) => {
      const parentNode = parent || document.body;
      parentNode.appendChild(element);
  
      if (children) {
        handleChildren(children, element as HTMLElement, childElements, document);
      }
      if (attributes.onAttach) {
        attributes.onAttach(ref as ElementDefinedRef);
      }
      return ref;
    };
  };
  
  const buildUtils = (document: Document) => ({
    create: createElement("http://www.w3.org/1999/xhtml", document),
    createSvg: createElement("http://www.w3.org/2000/svg", document),
    qs: (selector: any) => document.querySelector(selector),
    qsAll: (selector: any) => Array.from(document.querySelectorAll(selector)),
  });
  
  export const utils = buildUtils(document);
  
  const createElements = (names: string[], creator: (name: string) => UElement) => names.reduce((agg, next) => {
    agg[next] = creator(next);
    return agg;
  }, {});
  
  export const elements: UElementDictionary = createElements(
    "a|abbr|address|area|article|aside|audio|b|base|bdi|bdo|blockquote|body|br|button|canvas|caption|cite|code|col|colgroup|data|datalist|dd|del|details|dfn|div|dl|dt|em|embed|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|head|header|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|link|main|map|mark|meta|meter|nav|noscript|object|ol|optgroup|option|output|p|param|picture|pre|progress|q|rp|rt|rtc|ruby|s|samp|script|section|select|slot|small|source|span|strong|style|sub|summary|sup|table|tbody|td|template|textarea|tfoot|th|thead|time|title|tr|track|u|ul|var|video|wbr".split("|"),
    utils.create
  );
  
  export const svgElements: UElementDictionary = createElements(
    "svg|path|rect".split("|"),
    utils.createSvg
  );
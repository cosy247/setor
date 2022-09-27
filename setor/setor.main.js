(function (functory) {

  Object.defineProperty(window, "Setor" , {
    value:functory()
  })

})(() => {
  {
    let untilStyle = document.createElement("style");
    untilStyle.setAttribute("name", "pulsor.until");
    untilStyle.innerHTML = `
      [\\-until] {
        display: none;
        opacity: 0;
        pointer-events: none;
        z-index: -1;
        visibility: hidden;
      }`;
    document.head.appendChild(untilStyle);
  };

  class Lsnrctl {
    static callback = null;
    static isCalling = false;

    static refreshCalls = new Set();
    static autoRefresh = true;

    static proxySymbol = Symbol("isProxy");

    static getProxyHandler(callbacks = {}, callbackKey = "data", that) {
      return {
        get: (target, key, receiver) => {
          if (typeof key !== "symbol" && Lsnrctl.callback) {
            if (callbacks[`${callbackKey}.${key}`]) {
              if (!callbacks[`${callbackKey}.${key}`].includes(Lsnrctl.callback)) {
                callbacks[`${callbackKey}.${key}`].push(Lsnrctl.callback);
              }
            } else {
              callbacks[`${callbackKey}.${key}`] = [Lsnrctl.callback];
            }
          }
          let value = Reflect.get(target, key, receiver);
          if (typeof key !== "symbol" && value !== null && typeof value === "object" && !value[Lsnrctl.proxySymbol]) {
            let constructor = value.constructor;
            if (constructor === Array || constructor === Object) {
              value = new Proxy(value, Lsnrctl.getProxyHandler(callbacks, `${callbackKey}.${key}`));
              value[Lsnrctl.proxySymbol] = true;
              Reflect.set(target, key, value, receiver);
            }
          }
          return value;
        },
        set: (target, key, newValue, receiver) => {
          if (Reflect.get(target, key, receiver) === newValue && key !== "length") return true;
          let reflect = Reflect.set(target, key, newValue, receiver);
          if (typeof key !== "symbol") {
            this.handCalls(callbacks[`${callbackKey}.${key}`]);
          }
          return reflect;

          
        },
        deleteProperty(target, key, receiver) {
          let reflect = Reflect.deleteProperty(target, key, receiver);
          if (typeof key !== "symbol" && Reflect.has(target, key, receiver)) {
            this.handCalls(callbacks[`${callbackKey}.${key}`]);
          }
          return reflect;
        },
      };
    }

    static handCalls(calls) {
      if (Lsnrctl.isCalling || !calls) return;
      Lsnrctl.isCalling = true;
      if (Lsnrctl.autoRefresh) {
        calls.forEach(call => {
          Lsnrctl.callback = call;
          call();
          Lsnrctl.callback = null;
        });
      } else {
        calls.forEach(call => Lsnrctl.refreshCalls.add(call));
      }
      Lsnrctl.isCalling = false;
    }

    static getProxyData(data) {
      if (typeof data === "object") {
        return new Proxy(data, Lsnrctl.getProxyHandler(data));
      } else {
        return new Proxy({ v: data }, Lsnrctl.getProxyHandler({ v: data }));
      }
    }

    static clearRefresh() {
      Lsnrctl.refreshCalls.clear();
    }

    static refresh() {
      if (Lsnrctl.autoRefresh) return;
      Lsnrctl.isCalling = true;
      Lsnrctl.refreshCalls.forEach(call => {
        Lsnrctl.callback = call;
        call();
      });
      Lsnrctl.clearRefresh();
      Lsnrctl.isCalling = false;
    }
  }

  class Render {
    root = null;
    dataKeys = [];
    dataValues = [];

    isRendered = false;
    rendered = [];

    forKeys = [];
    forValues = [];

    ifConditions = [];
    lastIfElement = null;

    putNodes = {};

    constructor(root, data) {

      this.root = root;
      this.dataKeys = Object.keys(data);
      this.dataValues = Object.values(data);

      if (window.document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          this.renderRoot();
        });
      } else {
        this.renderRoot();
      }

    }

    renderRoot() {
      this.renderNode(this.root);
      this.isRendered = true;
      this.rendered.forEach(call => call());
    }

    renderNode(node) {
      if (node.nodeName === "#text") {
        this.renderText(node);
      } else {
        if (node.attributes && this.renderAttr(node)) return;
        if (node.childNodes) {
          for (const child of Array.from(node.childNodes)) {
            this.renderNode(child);
          }
        }
      }
    }

    // renderText
    renderText(node) {
      let match;
      while ((match = node.data.match(/\{\{.*?\}\}/)) !== null) {
        if (match.index !== 0) {
          node = node.splitText(match.index);
        }
        let newNode = node.splitText(match[0].length);
        this.renderTextCotnt(node, node.data.slice(2, -2));
        node = newNode;
      }
    }

    renderTextCotnt(node, valueString) {
      let valueFun = this.getValueFun(valueString);
      this.setLsnrctlCallback(() => {
        let value = valueFun();
        if (typeof value === "undefined") {
          node.data = "";
        } else if (typeof value === "object") {
          node.data = JSON.stringify(value);
        } else {
          node.data = value;
        }
      }, node);
    }

    // renderAttr
    renderAttr(node) {
      let bindAttrs = {};
      let eventAttrs = {};
      let specialAttrs = {};
      let retainAttrs = {};
      for (const attr of node.attributes) {
        let [attrName, ...adorns] = attr.name.split(".");
        if (attrName.length <= 1) continue;
        if (attrName[0] === ":") {
          bindAttrs[attr.name] = [attrName.slice(1), adorns, attr.value];
        } else if (attrName[0] === "@") {
          eventAttrs[attr.name] = [attrName.slice(1), adorns, attr.value];
        } else if (attrName[0] === "-") {
          specialAttrs[attr.name] = [attrName.slice(1), adorns, attr.value];
        } else if (attrName[0] === "+") {
          retainAttrs[attr.name] = [attrName.slice(1), adorns, attr.value];
        }
      }

      if (this.renderSpecials(node, specialAttrs)) return true;
      this.renderBinds(node, bindAttrs);
      this.renderEvents(node, eventAttrs);
      this.renderRetains(node, retainAttrs);
    }

    // renderBinds
    renderBinds(node, bindAttrs) {
      for (const attrAllName in bindAttrs) {
        if (Object.hasOwnProperty.call(bindAttrs, attrAllName)) {
          const [attrName, adorns, valueString] = bindAttrs[attrAllName];
          if (node.tagName.toUpperCase() === "INPUT" && attrName[0] === ":") {
            this.renderBind_mutual(node, attrName.slice(1), valueString, adorns);
          } else if (attrName === "class") {
            this.renderBind_class(node, valueString, adorns);
          } else if (attrName === "style") {
            this.renderBind_style(node, valueString, adorns);
          } else {
            this.renderBind_normal(node, attrName, valueString, adorns);
          }
          node.removeAttribute(attrAllName);
        }
      }
    }

    renderBind_normal(node, attrName, valueString, adorns) {
      let valueFun = this.getValueFun(valueString);
      this.setLsnrctlCallback(() => {
        let value = valueFun();
        if (Object.prototype.toString.call(value) === "[object String]") {
          node.setAttribute(attrName, value);
        } else if (attrName.indexOf("data-") === 0) {
          node.setAttribute(attrName, value);
        } else {
          node[attrName] = value;
        }
      }, node);
    }

    renderBind_class(node, valueString, adorns) {
      let className = node.className;
      let valueFun = this.getValueFun(valueString);
      this.setLsnrctlCallback(() => {
        let newClassName = className;
        let value = valueFun();
        if (value !== null && typeof value === "object") {
          for (const className in value) {
            if (Object.hasOwnProperty.call(value, className)) {
              if (value[className]) {
                newClassName += " " + className;
              }
            }
          }
        } else {
          newClassName += " " + value;
        }
        node.className = newClassName;
      }, node);
    }

    renderBind_style(node, valueString, adorns) {
      let style = node.getAttribute("style") || "";
      let valueFun = this.getValueFun(valueString);
      this.setLsnrctlCallback(() => {
        let newStyle = style;
        let value = valueFun();
        if (value !== null && typeof value === "object") {
          for (const styleName in value) {
            if (Object.hasOwnProperty.call(value, styleName)) {
              let styleValue = value[styleName];
              if (styleName === "transform" && Object.prototype.toString.call(styleValue) === "[object Object]") {
                let transform = "";
                for (const transName in styleValue) {
                  if (Object.hasOwnProperty.call(styleValue, transName)) {
                    transform += `${transName}(${styleValue[transName]})`;
                  }
                }
                styleValue = transform;
              }
              newStyle += styleName + ":" + styleValue + ";";
            }
          }
        } else {
          newStyle += value;
        }
        node.setAttribute("style", newStyle);
      }, node);
    }

    renderBind_mutual(node, type, valueString, adorns) {
      if (node.getAttribute(":lable")) {
        this.renderBind_normal(node, "lable", node.getAttribute(":lable"));
      }

      let forValueFun = null;
      if (this.forKeys.includes(valueString)) {
        forValueFun = this.forValues[this.forKeys.indexOf(valueString)];
      }

      let valueFun = this.getValueFun(valueString);
      let setValueFun;
      let model;
      if (node.type === "checkbox") {
        model = "change";
        let bindData = valueFun();
        if (Object.prototype.toString.call(bindData) === "[object Array]") {
          let lable = node.getAttribute("lable") || node.lable;
          this.setLsnrctlCallback(() => {
            node.checked = bindData.includes(lable);
          }, node);
          setValueFun = () => {
            if (node.checked && !bindData.includes(lable)) {
              bindData.push(lable);
            } else if (!node.checked && bindData.includes(lable)) {
              let index = bindData.indexOf(lable);
              bindData.splice(index, 1);
            }
          };
        } else {
          this.setLsnrctlCallback(() => {
            node.checked = valueFun();
          }, node);
          setValueFun = () => {
            // if (node.checked && !bindData.includes(lable)) {
            //   bindData.push(lable);
            // } else if (!node.checked && bindData.includes(lable)) {
            //   let index = bindData.indexOf(lable);
            //   bindData.splice(index, 1);
            // }
          };
        }
      } else if (node.type === "radio") {
        model = "change";
        this.setLsnrctlCallback(() => {
          node.checked = valueFun() === node.lable;
        }, node);
        if (forValueFun) {
          setValueFun = () => {
            if (node.checked) {
              forValueFun(node.lable);
            }
          };
        } else {
          let setFun = this.getValueFun(valueString + "=event.target.lable");
          setValueFun = () => {
            if (node.checked) {
              setFun();
            }
          };
        }
      } else {
        model = "input";
        this.setLsnrctlCallback(() => {
          node.value = valueFun();
        }, node);
        if (forValueFun) {
          setValueFun = () => {
            forValueFun(node.value);
          };
        } else {
          setValueFun = this.getValueFun(valueString + "=window.event.target.value");
        }
      }

      Array.from(new Set(type.split("."))).forEach(tp => {
        if (tp === "model") {
          node.addEventListener(model, event => {
            setValueFun();
          });
        } else {
          node.addEventListener(tp, event => {
            setValueFun();
          });
        }
      });
    }

    // renderEvents
    renderEvents(node, eventAttrs) {
      for (const attrAllName in eventAttrs) {
        if (Object.hasOwnProperty.call(eventAttrs, attrAllName)) {
          const [eventType, adorns, valueString] = eventAttrs[attrAllName];
          let valueFun = this.getValueFun(valueString);
          node.addEventListener(eventType, valueFun);
          node.removeAttribute(attrAllName);
        }
      }
    }

    // renderSpecials
    renderSpecials(node, specialAttrs) {
      for (let attrAllName in specialAttrs) {
        if (Object.hasOwnProperty.call(specialAttrs, attrAllName)) {
          const [attrName, adorns, valueString] = specialAttrs[attrAllName];
          let breakRender = false;
          if (attrName === "for") {
            breakRender = this.renderSpecial_for(node, valueString, adorns);
          } else if (attrName === "if") {
            breakRender = this.renderSpecial_if(node, valueString, adorns);
          } else if (attrName === "elif") {
            breakRender = this.renderSpecial_elif(node, valueString, adorns);
          } else if (attrName === "else") {
            breakRender = this.renderSpecial_else(node, adorns);
          } else if (attrName === "until") {
            breakRender = this.renderSpecial_until(node, adorns);
          } else if (attrName === "show") {
            breakRender = this.renderSpecial_show(node, valueString, adorns);
          } else if (attrName === "rise") {
            breakRender = this.renderSpecial_rise(node, valueString, adorns);
          } else if (attrName === "put") {
            breakRender = this.renderSpecial_put(node, valueString, adorns);
          }
          attrName === "until" || node.removeAttribute(attrAllName);
          if (breakRender) return true;
        }
      }
    }

    renderSpecial_for(node, valueString, adorns) {
      let [vk, forDataString] = valueString.split(" in ");
      let [v, k] = vk.split(",");

      let forAnchor = document.createComment(" render.for ");
      node.parentNode.insertBefore(forAnchor, node);
      node.parentNode.removeChild(node);

      let getForDataFun = this.getValueFun(forDataString);
      let forNodes = [];

      this.setLsnrctlCallback(() => {
        let forData = getForDataFun();
        let dataLength = typeof forData === "number" ? forData : forData.length;

        Lsnrctl.callback = null;
        if (dataLength > forNodes.length) {
          for (let index = forNodes.length; index < dataLength; index++) {
            let cloneNode = node.cloneNode(true);
            cloneNode.removeAttribute("-for");
            forNodes.push(cloneNode);
            forAnchor.parentNode.insertBefore(cloneNode, forAnchor);

            this.forKeys.push(v);
            if (typeof forData[index] === "object") {
              this.forValues.push(() => {
                return getForDataFun()[index];
              });
            } else {
              this.forValues.push(() => {
                return {
                  get v() {
                    return getForDataFun()[index];
                  },
                  set v(v) {
                    getForDataFun()[index] = v;
                  },
                };
              });
            }

            if (k) {
              this.forKeys.push(k);
              this.forValues.push(() => index);
            }

            this.renderNode(cloneNode);

            this.forKeys.pop();
            this.forValues.pop();
            if (k) {
              this.forKeys.pop();
              this.forValues.pop();
            }
          }
        } else if (dataLength < forNodes.length) {
          for (let index = dataLength; index < forNodes.length; index++) {
            forNodes[index].parentNode.removeChild(forNodes[index]);
          }
          forNodes.length = dataLength;
        }
      }, node);
      return true;
    }

    renderSpecial_if(node, valueString, adorns) {
      let ifAnchor = document.createComment("if");
      node.parentElement.insertBefore(ifAnchor, node);
      let valueFun = this.getValueFun(valueString);

      this.ifConditions = [valueFun];
      this.lastIfElement = node;

      this.setLsnrctlCallback(() => {
        if (valueFun()) {
          ifAnchor.parentElement.insertBefore(node, ifAnchor);
        } else {
          ifAnchor.parentElement.removeChild(node);
        }
      }, node);
    }

    renderSpecial_elif(node, valueString, adorns) {
      if (this.ifConditions.length === 0) return;

      let previousElementSibling = node.previousElementSibling;
      if (!previousElementSibling || previousElementSibling !== this.lastIfElement) return;

      let elifAnchor = document.createComment("elif");
      node.parentElement.insertBefore(elifAnchor, node);

      let valueFun = this.getValueFun(valueString);
      let ifConditions = [...this.ifConditions];
      this.ifConditions.push(valueFun);
      this.lastIfElement = node;

      this.setLsnrctlCallback(() => {
        for (const condition of ifConditions) {
          if (condition()) {
            elifAnchor.parentElement.removeChild(node);
            return;
          }
        }
        elifAnchor.parentElement.insertBefore(node, elifAnchor);
      }, node);
    }

    renderSpecial_else(node, adorns) {
      if (this.ifConditions.length === 0) return;

      let previousElementSibling = node.previousElementSibling;
      if (!previousElementSibling || previousElementSibling !== this.lastIfElement) return;

      let elseAnchor = document.createComment("elif");
      node.parentElement.insertBefore(elseAnchor, node);

      let ifConditions = [...this.ifConditions];

      this.ifConditions = [];
      this.lastIfElement = null;

      this.setLsnrctlCallback(() => {
        for (const condition of ifConditions) {
          if (condition()) {
            elseAnchor.parentElement.removeChild(node);
            return;
          }
        }
        elseAnchor.parentElement.insertBefore(node, elseAnchor);
      }, node);
    }

    renderSpecial_until(node, adorns) {
      this.rendered.push(() => {
        node.removeAttribute("-until");
      });
    }

    renderSpecial_show(node, valueString, adorns) {
      let valueFun = this.getValueFun(valueString);
      let display = node.style.display;
      let shiftStyle = {
        display: v => (v ? display : "none"),
      };
      if (adorns.includes("opacity")) {
        let opacity = node.style.opacity;
        let pointerEvents = node.style.pointerEvents;
        shiftStyle = {
          opacity: v => (v ? opacity : 0),
          pointerEvents: v => (v ? pointerEvents : "none"),
        };
      }
      this.setLsnrctlCallback(() => {
        let value = valueFun();
        for (const styleName in shiftStyle) {
          if (Object.hasOwnProperty.call(shiftStyle, styleName)) {
            node.style[styleName] = shiftStyle[styleName](value);
          }
        }
      }, node);
    }

    renderSpecial_rise(node, valueString, adorns) {
      let keyframes = this.renderSpecial_rise_adorns(node, adorns);
      let valueFun = this.getValueFun(valueString);

      this.setLsnrctlCallback(() => {
        if (valueFun()) {
          node.animate(keyframes, {
            duration : this.isRendered ? 500 : 0,
            fill: "both",
          });
        } else {
          node.animate(keyframes, {
            duration : this.isRendered ? 500 : 0,
            fill: "both",
            direction: "reverse"
          });
        }
      }, node);
    }

    renderSpecial_rise_adorns(node, adorns) {
      let nodeStyle = getComputedStyle(node);
      let keyframes = { 
        offset: [0, 1],
        visibility: ["hidden", "visible"],
      };

      if (adorns.includes("opacity")) {
        keyframes.opacity = [0, parseFloat(nodeStyle.opacity)];
      }

      let matrix = nodeStyle.transform;
      let matrixs, is3d;
      if (matrix === "none") {
        matrix = "matrix(1,0,0,1,0,0)";
        matrixs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      } else {
        is3d = matrix.indexOf("3d") >= 0;
        matrixs = matrix.slice(is3d ? 9 : 7, -1).split(",").map(n => +n);
      }

      let translate = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      if (adorns.includes("left")) {
        translate[0][2] = -20;
      } else if (adorns.includes("right")) {
        translate[0][2] = 20;
      }
      if (adorns.includes("bottom")) {
        translate[1][2] = 20;
      } else if (adorns.includes("top")) {
        translate[1][2] = -20;
      }

      let scale = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      if (adorns.includes("scale")) {
        scale[0][0] = 0.0001;
        scale[1][1] = 0.0001;
      } else if (adorns.includes("scaleX")) {
        scale[0][0] = 0.0001;
      } else if (adorns.includes("scaleY")) {
        scale[1][1] = 0.0001;
      }

      let rotate = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      if (adorns.includes("rotate")) {
        rotate[0][0] = rotate[1][1] = Math.cos(Math.PI);
        rotate[0][1] = -Math.sin(Math.PI);
        rotate[1][0] = Math.sin(Math.PI);
      }

      let newMatrixs = [translate, scale, rotate].reduce((a, b) => {
        let c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
              c[i][j] += a[i][k] * b[k][j];
            }
          }
        }
        return c;
      }, matrixs);

      let newMatrix = "matrix(" +
        newMatrixs[0][0] + "," +
        newMatrixs[1][0] + "," +
        newMatrixs[0][1] + "," +
        newMatrixs[1][1] + "," +
        newMatrixs[0][2] + "," +
        newMatrixs[1][2] +
        ")";
      keyframes.transform = [newMatrix, matrix];

      return keyframes;
    }

    renderSpecial_put(node, valueString, adorns) {
      let putAnchor = document.createComment("put");
      node.parentElement.insertBefore(putAnchor, node);

      if (adorns.includes("id")) {
        node.parentElement.removeChild(node);
        this.putNodes[valueString] = putAnchor;
      } else {
        let valueFun = this.getValueFun(valueString);
        this.setLsnrctlCallback(() => {
          let value = valueFun();
          let newAnchor;
          if (typeof value === "object") {
            for (const selector in value) {
              if (Object.hasOwnProperty.call(value, selector)) {
                if (value[selector]) {
                  newAnchor = selector;
                  break;
                }
              }
            }
          } else {
            newAnchor = value;
          }

          if (newAnchor === "#") {
            newAnchor = putAnchor;
          } else {
            newAnchor = this.putNodes[value];
          }

          if (newAnchor && newAnchor !== node.nextSibling) {
            newAnchor.parentElement.insertBefore(node, newAnchor);
          }
        })
      }
    }

    // specialRetains
    renderRetains(node, retainAttrs) {
      if (!node.retainAttrs) node.retainAttrs = {};
      for (let attrAllName in retainAttrs) {
        if (Object.hasOwnProperty.call(retainAttrs, attrAllName)) {
          const [attrName, adorns, valueString] = retainAttrs[attrAllName];
          node.retainAttrs[attrName] = this.getValueFun(valueString)();
          node.removeAttribute(attrAllName);
        }
      }
    }

    // setLsnrctlCallback
    setLsnrctlCallback(callback, node) {
      Lsnrctl.callback = () => {
        callback();
      };
      Lsnrctl.callback();
      Lsnrctl.callback = null;
    }

    // getValueFun
    getValueFun(valueString) {
      valueString = valueString.replaceAll("\n", "\\n") || undefined;
      let dataKeys = this.dataKeys;
      let dataValues = this.dataValues;
      let forKeys = [...this.forKeys];
      let forValueFuns = [...this.forValues];
      return () => {
        let funProps = [...dataKeys, ...forKeys];
        let funValues = [...dataValues, ...forValueFuns.map(v => v())];
        return new Function(...funProps, `return (${valueString})`)(...funValues);
      };
    }
  }

  return class {
    static bind(data) {
      return Lsnrctl.getProxyData(data);
    }

    static render(selector, data = {}) {
      let root = null;
      if (selector instanceof Node) {
        root = selector;
      } else if (typeof selector === "string") {
        root = document.querySelector(selector);
      }
      if (!root) throw "Render.root not is a Node or NodeSelector!";
      if (data !== null && data.constructor !== Object) throw "Render.Data not is a undefined or object!";
      root && new Render(root, data);
    }

    static watch(watchPropsCall, callback) {
      Lsnrctl.callback = () => {
        Lsnrctl.callback = null;
        callback();
      };
      watchPropsCall();
      Lsnrctl.callback = null;
    }

    static get autoRefresh() {
      return Lsnrctl.autoRefresh;
    }

    static set autoRefresh(v) {
      Lsnrctl.autoRefresh = v ? true : false;
    }

    static refresh() {
      Lsnrctl.refresh();
    }

    static clearRefresh() {
      Lsnrctl.clearRefresh();
    }
  };
});
image.png
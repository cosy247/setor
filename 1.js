(function (functory) {
  window.Pulsor = functory();
})(() => {
  Symbol.isProxy = Symbol("Lsnrctl.Proxy");

  class Lsnrctl {
    static callback = null;
    static isDuty = true;
    static Proxy(target, handler) {
      let proxy = new Proxy(target, handler);
      target[Symbol.isProxy] = "Lsnrctl.Proxy";
      return proxy;
    }

    static getProxyHandler(callbacks = {}, callbackKey = "data") {
      return {
        get: (target, key, receiver) => {
          if (Lsnrctl.isDuty && typeof key !== "symbol") {
            if (Lsnrctl.callback) {
              if (callbacks[`${callbackKey}.${key}`]) {
                if (!callbacks[`${callbackKey}.${key}`].includes(Lsnrctl.callback)) {
                  callbacks[`${callbackKey}.${key}`].push(Lsnrctl.callback);
                }
              } else {
                callbacks[`${callbackKey}.${key}`] = [Lsnrctl.callback];
              }
            }
          }
          let value = Reflect.get(target, key, receiver);
          if (value !== null && typeof value == "object") {
            if (value[Symbol.isProxy] !== "Lsnrctl.Proxy") {
              value = Lsnrctl.Proxy(value, Lsnrctl.getProxyHandler(callbacks, `${callbackKey}.${key}`));
              Reflect.set(target, key, value, receiver);
            }
          }
          return value;
        },
        set: (target, key, newValue, receiver) => {
          let reflect = true;
          if (!Lsnrctl.callback) {
            Reflect.set(target, key, newValue, receiver);
            if (typeof key !== "symbol") {
              callbacks[`${callbackKey}.${key}`] && callbacks[`${callbackKey}.${key}`].forEach((call) => call());
            }
            if (Object.prototype.toString.call(target) == "[object Array]") {
              target.length = target.length;
            }
          }
          return reflect;
        },
        deleteProperty(target, key, receiver) {
          if (!Lsnrctl.callback) {
            let reflect = Reflect.deleteProperty(target, key, receiver);
            callbacks[`${callbackKey}.${key}`] && callbacks[`${callbackKey}.${key}`].forEach((call) => call());
            return reflect;
          }
          return false;
        },
      };
    }

    static getProxyData(data) {
      if (typeof data == "object") {
        return new Proxy(data, Lsnrctl.getProxyHandler());
      } else {
        return new Proxy({ v: data }, Lsnrctl.getProxyHandler());
      }
    }
  }

  class Render {
    pulsor = null;

    dataKeys = [];
    dataValues = [];

    forKeys = [];
    forValues = [];

    ifConditions = [];
    lastIfElement = null;

    constructor(pulsor, data, root) {
      this.pulsor = pulsor;
      if (typeof data == "object") {
        this.dataKeys = Object.keys(data);
        this.dataValues = Object.values(data);
      }
      this.renderNode(root);
    }

    renderNode(node) {
      if (node.nodeName == "#comment") {
        return;
      }
      if (node.nodeName == "#text") {
        this.renderText(node);
      } else {
        if (node.getAttribute("-for")) {
          this.renderAttr(node, "-for", node.getAttribute("-for"));
        } else {
          for (const child of Array.from(node.childNodes)) {
            this.renderNode(child);
          }
          // if (Object.hasOwnProperty.call(node, "attributes")) {
          for (const attr of Array.from(node.attributes)) {
            this.renderAttr(node, attr.name, attr.value);
          }
          // }
        }
      }
    }

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
        if (typeof value == "undefined") {
          node.data = "";
        } else if (typeof value == "object") {
          node.data = JSON.stringify(value);
        } else {
          node.data = value;
        }
      }, node);
    }

    renderAttr(node, attrName, valueString) {
      if (attrName.length == 1) return;
      let mark = attrName[0];
      if ([":", "@", "-"].indexOf(mark) >= 0) {
        node.removeAttribute && node.removeAttribute(attrName);
        attrName = attrName.slice(1);
        if (mark == ":") {
          this.renderBind(node, attrName, valueString);
        } else if (mark == "@") {
          this.renderEvent(node, attrName, valueString);
        } else if (mark == "-") {
          this.renderSpecial(node, attrName, valueString);
        }
      }
    }

    renderBind(node, attrName, valueString) {
      if (node.tagName.toUpperCase() == "INPUT" && attrName[0] == ":") {
        this.renderTwoWayBind(node, attrName.slice(1), valueString);
      } else if (attrName == "class") {
        this.renderBind_class(node, valueString);
      } else if (attrName == "style") {
        this.renderBind_style(node, valueString);
      } else {
        let valueFun = this.getValueFun(valueString);
        this.setLsnrctlCallback(() => {
          let value = valueFun();
          if (typeof value == "object" || typeof value == "function") {
            node[attrName] = value;
          } else {
            node.setAttribute(attrName, value);
          }
        }, node);
      }
    }

    renderBind_class(node, valueString) {
      let className = node.className;
      let valueFun = this.getValueFun(valueString);
      this.setLsnrctlCallback(() => {
        node.className = className;
        let value = valueFun();
        if (value !== null && typeof value == "object") {
          for (const className in value) {
            if (Object.hasOwnProperty.call(value, className)) {
              if (value[className]) {
                node.classList.add(className);
              }
            }
          }
        } else {
          node.className += " " + value;
        }
      }, node);
    }

    renderBind_style(node, valueString) {
      let style = node.style;
      let valueFun = this.getValueFun(valueString);
      this.setLsnrctlCallback(() => {
        node.style = style;
        let value = valueFun();
        if (value !== null && typeof value == "object") {
          for (const styleName in value) {
            if (Object.hasOwnProperty.call(value, styleName)) {
              node.style[styleName] = value[styleName];
            }
          }
        } else {
          node.cssText += value;
        }
      }, node);
    }

    renderTwoWayBind(node, type, valueString) {
      if (node.getAttribute(":lable")) {
        this.renderBind(node, "lable", node.getAttribute(":lable"));
      }

      let forValueFun = null;
      if (this.forKeys.includes(valueString)) {
        forValueFun = this.forValues[this.forKeys.indexOf(valueString)];
      }

      let valueFun = this.getValueFun(valueString);
      let setValueFun;
      let model;
      if (node.type == "checkbox") {
        model = "change";
        let bindArr = valueFun();
        this.setLsnrctlCallback(() => {
          node.checked = bindArr.includes(node.lable);
        }, node);
        setValueFun = () => {
          if (node.checked && !bindArr.includes(node.lable)) {
            bindArr.push(node.lable);
          } else if (!node.checked && bindArr.includes(node.lable)) {
            let index = bindArr.indexOf(node.lable);
            bindArr.splice(index, 1);
          }
        };
      } else if (node.type == "radio") {
        model = "change";
        this.setLsnrctlCallback(() => {
          node.checked = valueFun() == node.lable;
        }, node);
        if (forValueFun) {
          setValueFun = () => {
            if (node.checked) {
              forValueFun(node.lable);
            }
          };
        } else {
          let setFun = this.getValueFun(valueString + "=window.event.target.lable");
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

      Array.from(new Set(type.split("."))).forEach((tp) => {
        if (tp == "model") {
          node.addEventListener(model, setValueFun);
        } else {
          node.addEventListener(tp, setValueFun);
        }
      });
    }

    renderEvent(node, attrName, valueString) {
      let valueFun = this.getValueFun(valueString);
      node.addEventListener(attrName, valueFun);
    }

    renderSpecial(node, attrName, valueString) {
      if (attrName == "for") {
        this.renderSpecial_for(node, valueString);
      } else if (attrName == "show") {
        this.renderSpecial_show(node, valueString);
      } else if (attrName == "if") {
        this.renderSpecial_if(node, valueString);
      } else if (attrName == "elif") {
        this.renderSpecial_elif(node, valueString);
      } else if (attrName == "else") {
        this.renderSpecial_else(node);
      }
    }

    renderSpecial_for(node, valueString) {
      let [vk, forDataString] = valueString.split(" in ");
      let [v, k] = vk.split(",");

      let forAnchor = document.createComment(" render.for ");
      node.parentNode.insertBefore(forAnchor, node);
      node.parentNode.removeChild(node);

      let getForDataFun = this.getValueFun(forDataString);
      let forNodes = [];

      this.setLsnrctlCallback(() => {
        let forData = getForDataFun();

        if (typeof forData == "number") {
          forData = new Array(forData).fill(null).map((_, x) => x);
        }
        let dataLength = forData.length;

        if (dataLength > forNodes.length) {
          for (let index = forNodes.length; index < dataLength; index++) {
            let cloneNode = node.cloneNode(true);
            forNodes.push(cloneNode);
            forAnchor.parentNode.insertBefore(cloneNode, forAnchor);

            this.forKeys.push(v);
            if (typeof forData[index] == "object") {
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
            this.forKeys.pop();
            this.forValues.pop();
            this.forValues.pop();
          }
        } else if (dataLength < forNodes.length) {
          for (let index = dataLength; index < forNodes.length; index++) {
            forNodes[index].parentNode.removeChild(forNodes[index]);
          }
          forNodes.length = dataLength;
        }
      }, node);
    }

    renderSpecial_show(node, valueString) {
      let valueFun = this.getValueFun(valueString);
      let display = node.style.display;
      this.setLsnrctlCallback(() => {
        node.style.display = valueFun() ? display : "none";
      }, node);
    }

    renderSpecial_if(node, valueString) {
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

    renderSpecial_elif(node, valueString) {
      if (this.ifConditions.length == 0) return;

      let previousElementSibling = node.previousElementSibling;
      if (!previousElementSibling || previousElementSibling != this.lastIfElement) return;

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

    renderSpecial_else(node) {
      if (this.ifConditions.length == 0) return;

      let previousElementSibling = node.previousElementSibling;
      if (!previousElementSibling || previousElementSibling != this.lastIfElement) return;

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

    setLsnrctlCallback(callback, node) {
      Lsnrctl.callback = () => {
        this.pulsor.renderingNode = node;
        callback();
        this.pulsor.renderingNode = null;
      };
      Lsnrctl.callback();
      Lsnrctl.callback = null;
    }

    getValueFun(valueString) {
      valueString = valueString.replaceAll("\n", "\\n");
      let forKeys = [...this.forKeys];
      let forValueFuns = [...this.forValues];
      return () => {
        let funProps = [...this.dataKeys, ...forKeys];
        let funValues = [...this.dataValues, ...forValueFuns.map((v) => v())];
        return new Function(...funProps, `return (${valueString})`).apply(null, funValues);
      };
    }
  }

  return class Pulsor {
    static beforeCreate = [];
    static created = [];

    renderingNode = null;

    constructor(root, data) {
      if (Object.prototype.toString.call(Pulsor.beforeCreate) == "[object Array]") {
        Pulsor.beforeCreate.forEach((callback) => callback.call(this));
      }
      this.render(root, data);
      if (Object.prototype.toString.call(Pulsor.created) == "[object Array]") {
        Pulsor.created.forEach((callback) => callback.call(this));
      }
    }

    static bind(data) {
      return Lsnrctl.getProxyData(data);
    }

    render(root, data) {
      if (root instanceof Element) {
        new Render(this, data, root);
      } else if (typeof root == "string") {
        root = document.querySelector(root);
        root && new Render(this, data, root);
      }
    }
  };
});
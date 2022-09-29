(function (functory) {

  Setor && functory(Setor);

})((Setor) => {
  let componentHtmlMap = {};
  let rootCss = null;

  function renderShadow(root, shadow, html) {
    shadow.innerHTML = html;

    let allScripts = Array.from(shadow.querySelectorAll("script"));
    let allScriptText = allScripts.map(script => script.innerHTML).join(";");
    allScripts.forEach(script => script.parentNode.removeChild(script));

    let setor = new Setor();
    setor.shadow = shadow;
    setor.props = root.dataset;
    new Function("setor", allScriptText)(setor);
    Setor.render(shadow, setor.data);

    if (rootCss) {
      let link = document.createElement("link");
      link.setAttribute("rel", "stylesheet");
      link.setAttribute("href", rootCss);
      rootCss && shadow.appendChild(link);
    }
  }

  Object.assign(Setor, {
    rootCss(v) {
      if (!rootCss) rootCss = v;
    },
    components(components) {
      for (let componentName in components) {
        if (Object.hasOwnProperty.call(components, componentName)) {
          const componentPath = components[componentName];
          componentName = componentName.replace(/^[A-Z]/, r => r.toLowerCase());
          componentName = componentName.replace(/(?<!^)[A-Z]/g, r => "-" + r.toLowerCase());
          if (componentHtmlMap[componentName]) return;
          componentHtmlMap[componentName] = true;
          customElements.define(
            componentName,
            class extends HTMLElement {
              constructor() {
                super();
                let shadow = this.attachShadow({ mode: "open" });
                if (componentHtmlMap[componentName] === true) {
                  fetch(componentPath + ".html")
                    .then(data => data.text())
                    .then(html => {
                      componentHtmlMap[componentName] = html;
                      renderShadow(this, shadow, html);
                    });
                } else {
                  renderShadow(this, shadow, componentHtmlMap[componentName]);
                }
              }
            }
          );
        }
      }
    },
  })

  Object.assign(Setor.prototype, {
    shadow: null,
    props: null,
    cite(data) {
      this.data = data;
    },
    get(selector) {
      return this.shadow.querySelector(selector);
    },
    getAll(selector) {
      return this.shadow.querySelectorAll(selector);
    }
  });
})
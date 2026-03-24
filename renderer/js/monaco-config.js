/* Sirius IDE — конфиг Monaco (вынесен из inline из-за CSP) */
(function () {
  var docDir = location.pathname.replace(/\/[^/]*$/, '/');
  var vsAbs = location.protocol + '//' + location.host + docDir + '../node_modules/monaco-editor/min/vs/';
  vsAbs = vsAbs.replace(/([^:])\/\/+/g, '$1/');
  window.require = {
    paths: { vs: vsAbs },
    'vs/nls': { availableLanguages: { '*': '' } }
  };
})();

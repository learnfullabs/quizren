/**
 * MathJax v4 Configuration for QuizRen module.
 */
window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true
  },
  svg: {
    fontCache: 'global'
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    ignoreHtmlClass: 'tex2jax_ignore',
    processHtmlClass: 'tex2jax_process'
  },
  startup: {
    ready: function () {
      console.log('QuizRen: MathJax v4 loaded and ready');
      MathJax.startup.defaultReady();
    }
  }
};

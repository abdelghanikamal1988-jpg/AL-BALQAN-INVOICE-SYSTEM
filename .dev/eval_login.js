const input = document.querySelector('.login-card input[type="email"]');
if (!input) {
  JSON.stringify({
    href: location.href,
    err: 'no input',
    bodyKids: Array.from(document.body.children).map(function (e) { return e.className || e.tagName; }).slice(0, 5),
    txt: document.body.innerText.slice(0, 160)
  });
} else {
  input.focus();
  const cs = getComputedStyle(input);
  JSON.stringify({
    href: location.href,
    autofill: input.matches(':-webkit-autofill'),
    active: document.activeElement === input,
    bg: cs.backgroundColor,
    color: cs.color,
    borderBottom: cs.borderBottomColor + ' ' + cs.borderBottomWidth,
    outline: cs.outlineColor + ' ' + cs.outlineWidth + ' ' + cs.outlineStyle,
    boxShadow: cs.boxShadow,
    cls: input.className,
    fieldCls: input.closest('.field') ? input.closest('.field').className : ''
  });
}

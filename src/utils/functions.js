function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => i + start);
}

function contains(array, query) {
  const lowerCaseQuery = query.toLowerCase();
  return array.filter((value) => value.toLowerCase().includes(lowerCaseQuery));
}

function choice(choices) {
  return choices[Math.floor(Math.random() * choices.length)];
}

function randomInteger(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function isURL(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function getLocaleWithoutString(strings, command, language, ...vars) {
  let locale = strings[command][language];
  let count = 0;
  locale = locale.replace(/%VAR%/g, () => (vars[count] !== null ? vars[count] : "%VAR%"));

  return locale;
}

function getLocale(strings, command, string, language, ...vars) {
  let locale = strings[command][string][language];

  let count = 0;

  const replaceVars = (str) => str.replace(/%VAR%/g, () => (vars[count] !== null ? vars[count] : "%VAR%"));

  const loc = Array.isArray(locale) ? locale.map(replaceVars) : replaceVars(locale);

  return loc;
}

export {
  range,
  choice,
  contains,
  randomInteger,
  isURL,
  getLocale,
  getLocaleWithoutString,
};

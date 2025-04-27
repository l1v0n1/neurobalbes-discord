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
  // Check if command exists in strings
  if (!strings[command]) return null;
  
  // Check if language exists in the command
  let locale = strings[command][language] || strings[command]['en']; // fallback to English
  if (!locale) return null;
  
  let count = 0;
  locale = locale.replace(/%VAR%/g, () => (vars[count] !== null ? vars[count] : "%VAR%"));

  return locale;
}

function getLocale(strings, command, string, language, ...vars) {
  // Check if the necessary structure exists
  if (!strings || !strings[command] || !strings[command][string]) {
    return null;
  }
  
  // Get the locale string, fallback to English if the language doesn't exist
  let locale = strings[command][string][language] || strings[command][string]['en'];
  
  // If still no locale, return null
  if (!locale) {
    return null;
  }

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

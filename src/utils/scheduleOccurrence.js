import { DAYS, startOfWeek, toKey, weekdayIndex } from "./dateHelpers";

const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

// La séance a-t-elle lieu à cette date ?
// Les anciennes séances (sans "repeat") sont considérées comme hebdomadaires.
export const occursOn = (item, date) => {
  const key = toKey(date);
  const repeat = item.repeat || "weekly";
  if (repeat === "none") return item.date === key;
  if (item.day !== DAYS[weekdayIndex(date)]) return false;
  if (item.startDate && key < item.startDate) return false;
  if (item.endDate && key > item.endDate) return false;
  if (repeat === "biweekly" && item.startDate) {
    const weeks = Math.round((startOfWeek(date) - startOfWeek(parseKey(item.startDate))) / (7 * 24 * 3600 * 1000));
    return weeks % 2 === 0;
  }
  return true;
};

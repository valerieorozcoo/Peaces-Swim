import { route, HttpError } from "../../lib/http.js";
import { customerFromToken, loadCustomer, saveLedger, accountView } from "../../lib/rewards.js";
// POST /api/account/birthday { token, month, day } → saves her birthday once (50 Peace Points every birthday month).
export default route(["POST"], async (body) => {
  const c = await customerFromToken(body.token);
  const m = +body.month, d = +body.day;
  const max = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m] || 0;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= max)) throw new Error("Pick your birthday month and day.");
  const { ledger } = await loadCustomer(c.id);
  if (ledger.birthday) throw new HttpError(409, "Your birthday is already saved. Email info@peacesswim.com to change it.");
  ledger.birthday = String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  await saveLedger(c.id, ledger);
  return accountView(c);
});

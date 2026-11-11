import { route, HttpError } from "../../lib/http.js";
import { customerFromToken, loadCustomer, balanceOf, applyBonuses, saveLedger, rewardCode, createRewardCode, accountView, REWARD_POINTS, REWARD_OFF } from "../../lib/rewards.js";
// POST /api/account/redeem { token } → turns 100 Peace Points into a $10-off code that only she can use.
export default route(["POST"], async (body) => {
  const c = await customerFromToken(body.token);
  const { orders, ledger } = await loadCustomer(c.id);
  applyBonuses(ledger);
  if (balanceOf(ledger, orders).balance < REWARD_POINTS) throw new HttpError(400, "You need " + REWARD_POINTS + " Peace Points for a reward.");
  const code = rewardCode();
  await createRewardCode(c.id, code);
  ledger.redeemed.push({ code, pts: REWARD_POINTS, off: REWARD_OFF, at: new Date().toISOString() });
  await saveLedger(c.id, ledger);
  return { ok: true, code, account: await accountView(c) };
});

import { route } from "../../lib/http.js";
import { customerFromToken, accountView } from "../../lib/rewards.js";
// POST /api/account/me { token } → her Peaces account: Peace Points, reward codes, orders.
export default route(["POST"], async (body) => accountView(await customerFromToken(body.token)));

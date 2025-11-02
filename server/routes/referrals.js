import express from "express";
import {
  awardReferralBonus,
  buildReferralLinks,
  createReferralRelation,
  findReferralOwnerByCode,
  getOrCreateReferralCode,
  getReferralStatsForUser,
  getRelationByReferred,
  parseReferralPayload,
} from "../referral-service.js";
import { requireTelegramUser } from "../telegram.js";

const router = express.Router();

const normalizeUserId = (user) => String(user.id);

router.post("/generate", (req, res, next) => {
  try {
    const user = requireTelegramUser(req);
    const campaign = req.body?.campaign ?? null;
    const { code, createdAt } = getOrCreateReferralCode(normalizeUserId(user));
    const links = buildReferralLinks(code, { campaign });

    return res.json({
      referralCode: code,
      links,
      createdAt,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/validate", (req, res, next) => {
  try {
    const user = requireTelegramUser(req);
    const startParam = req.body?.startParam;
    if (!startParam || typeof startParam !== "string") {
      return res.status(400).json({ error: "startParam is required" });
    }

    const context = parseReferralPayload(startParam);
    if (!context.isReferral || !context.code) {
      return res.status(400).json({ error: "Invalid referral payload" });
    }

    const owner = findReferralOwnerByCode(context.code);
    if (!owner) {
      return res.status(404).json({ error: "Referral code not found" });
    }

    const referredId = normalizeUserId(user);
    if (owner.userId === referredId) {
      return res.status(400).json({ error: "Self-referral is not allowed" });
    }

    const { created, relation } = createReferralRelation(owner.userId, user, {
      campaign: context.campaign,
    });

    if (!created) {
      return res.status(200).json({
        valid: false,
        reason: "already_referred",
        referrerId: relation.referrer_id,
      });
    }

    return res.status(201).json({
      valid: true,
      referrerId: owner.userId,
      referralCode: owner.code,
      campaign: context.campaign,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/stats", (req, res, next) => {
  try {
    const user = requireTelegramUser(req);
    const stats = getReferralStatsForUser(normalizeUserId(user));

    return res.json(stats);
  } catch (error) {
    return next(error);
  }
});

router.post("/reward", (req, res, next) => {
  try {
    const user = requireTelegramUser(req);
    const goldEarned = Number(req.body?.goldEarned ?? 0);
    if (!Number.isFinite(goldEarned) || goldEarned <= 0) {
      return res.status(400).json({ error: "goldEarned must be a positive number" });
    }

    const relation = getRelationByReferred(normalizeUserId(user));
    if (!relation) {
      return res.json({ awarded: false, bonus: 0 });
    }

    const result = awardReferralBonus({
      referredUserId: normalizeUserId(user),
      goldEarned,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;

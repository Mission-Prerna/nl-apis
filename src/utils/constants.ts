export const CONSTANTS = {
  BADGE_LEVEL: {
    BRONZE: 'BRONZE',
    SILVER: 'SILVER',
    GOLD: 'GOLD',
  },
  BADGE_IMAGE: {
    BRONZE: `https://${process.env.MINIO_URL}/nl-assets/badge_bronze.png`,
    SILVER: `https://${process.env.MINIO_URL}/nl-assets/badge_silver.png`,
    GOLD: `https://${process.env.MINIO_URL}/nl-assets/badge_gold.png`,
  },
  BADGE_LEVEL_THRESHOLD: {
    BRONZE: { min: 0, max: 59 },
    SILVER: { min: 60, max: 79 },
    GOLD: { min: 80, max: 100 },
  },
  COMPETENCY_IMAGE: {
    VERBAL: `https://${process.env.MINIO_URL}/nl-assets/verbal_icon.png`,
    MATH: `https://${process.env.MINIO_URL}/nl-assets/math_icon.png`,
    HINDI: `https://${process.env.MINIO_URL}/nl-assets/hindi_icon.png`,
  },
};

/**
 * Curated reference data that no npm package gives us cleanly:
 * which entries count toward the 195, and which territories nest under a parent.
 */

/** 193 UN member states. */
export const UN_MEMBERS = [
  // Africa (54)
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET',
  'GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW',
  'ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW',
  // Americas (35)
  'AG','AR','BS','BB','BZ','BO','BR','CA','CL','CO','CR','CU','DM','DO','EC','SV','GD','GT','GY','HT',
  'HN','JM','MX','NI','PA','PY','PE','KN','LC','VC','SR','TT','US','UY','VE',
  // Asia (47)
  'AF','AM','AZ','BH','BD','BT','BN','KH','CN','CY','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW',
  'KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PH','QA','SA','SG','KR','LK','SY','TJ','TH',
  'TL','TR','TM','AE','UZ','VN','YE',
  // Europe (43)
  'AL','AD','AT','BY','BE','BA','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV',
  'LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE',
  'CH','UA','GB',
  // Oceania (14)
  'AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU',
]

/** UN observer states — counted alongside members to reach the familiar 195. */
export const UN_OBSERVERS = ['VA', 'PS']

/** Territory -> sovereign state, mirroring how the add-visit list nests them. */
export const PARENT_OF = {
  // United Kingdom
  AI: 'GB', BM: 'GB', IO: 'GB', VG: 'GB', KY: 'GB', FK: 'GB', GI: 'GB', MS: 'GB',
  PN: 'GB', SH: 'GB', GS: 'GB', TC: 'GB', GG: 'GB', JE: 'GB', IM: 'GB',
  // United States
  AS: 'US', GU: 'US', MP: 'US', PR: 'US', VI: 'US', UM: 'US',
  // France
  GF: 'FR', PF: 'FR', TF: 'FR', GP: 'FR', MQ: 'FR', YT: 'FR', NC: 'FR', RE: 'FR',
  BL: 'FR', MF: 'FR', PM: 'FR', WF: 'FR',
  // Netherlands
  AW: 'NL', CW: 'NL', SX: 'NL', BQ: 'NL',
  // Denmark
  FO: 'DK', GL: 'DK',
  // New Zealand
  CK: 'NZ', NU: 'NZ', TK: 'NZ',
  // Australia
  CX: 'AU', CC: 'AU', HM: 'AU', NF: 'AU',
  // Norway / Finland / China
  BV: 'NO', SJ: 'NO',
  AX: 'FI',
  HK: 'CN', MO: 'CN',
}

/** CLDR is good in Korean; these two are just needlessly long for a list row. */
export const NAME_OVERRIDES_KO = {
  HK: '홍콩',
  MO: '마카오',
}

export const CONTINENT_KO = {
  AS: '아시아',
  EU: '유럽',
  AF: '아프리카',
  NA: '북아메리카',
  SA: '남아메리카',
  OC: '오세아니아',
  AN: '남극',
}

/** Draw order for the passport screen. */
export const CONTINENT_ORDER = ['EU', 'AS', 'AF', 'NA', 'SA', 'OC', 'AN']

export const HELLO_PRO_TRAINEE_GROUP = "ハロプロ研修生";
export const HELLO_PRO_TRAINEE_HOKKAIDO_GROUP = "ハロプロ研修生北海道";
export const HELLO_PRO_TRAINEE_UNIT_GROUP = "ハロプロ研修生ユニット";
export const HELLO_PRO_TRAINEE_UNIT_22_GROUP = "ハロプロ研修生ユニット'22";
export const HELLO_PRO_TRAINEE_UNIT_22_GROUP_ALT = "ハロプロ研修生ユニット’22";

export const HELLO_PRO_TRAINEE_CORE_GROUP_NAMES = [
    HELLO_PRO_TRAINEE_GROUP,
    HELLO_PRO_TRAINEE_HOKKAIDO_GROUP,
] as const;

export const HELLO_PRO_TRAINEE_GROUP_EXCLUDE_NAMES = [
    ...HELLO_PRO_TRAINEE_CORE_GROUP_NAMES,
    "ハロプロエッグ",
] as const;

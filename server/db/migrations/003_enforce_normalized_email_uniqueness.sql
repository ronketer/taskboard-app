CREATE UNIQUE INDEX idx_users_email_normalized
ON users (LOWER(BTRIM(email)));

UPDATE users
SET email = LOWER(BTRIM(email))
WHERE email <> LOWER(BTRIM(email));

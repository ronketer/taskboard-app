CREATE TABLE boards (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  created_by  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_personal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (CHAR_LENGTH(BTRIM(name)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX idx_boards_personal_creator
ON boards (created_by)
WHERE is_personal = TRUE;

CREATE TABLE board_members (
  board_id   INT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(10) NOT NULL CHECK (role IN ('OWNER', 'MEMBER')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

CREATE UNIQUE INDEX idx_board_members_single_owner
ON board_members (board_id)
WHERE role = 'OWNER';

CREATE INDEX idx_board_members_user_board
ON board_members (user_id, board_id);

ALTER TABLE todos
ADD COLUMN board_id INT REFERENCES boards(id) ON DELETE CASCADE;

INSERT INTO boards (name, created_by, is_personal)
SELECT 'Personal', id, TRUE
FROM users;

INSERT INTO board_members (board_id, user_id, role)
SELECT id, created_by, 'OWNER'
FROM boards
WHERE is_personal = TRUE;

UPDATE todos
SET board_id = boards.id
FROM boards
WHERE boards.is_personal = TRUE
  AND boards.created_by = todos.created_by;

ALTER TABLE todos
ALTER COLUMN board_id SET NOT NULL;

CREATE INDEX idx_todos_board_created_at_id
ON todos (board_id, created_at DESC, id DESC);

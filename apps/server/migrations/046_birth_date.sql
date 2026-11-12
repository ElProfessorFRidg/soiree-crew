-- O-02: the date of birth given in the arrival flow. The server refuses anyone under 18 and keeps
-- the date only to answer with an age; it is never sent to other people. It is separate from the
-- optional crew birthday (QOL-21), which stays an opt-in with its own audience.
alter table users add column birth_date text;

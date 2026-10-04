CREATE SEQUENCE IF NOT EXISTS employee_number_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

DO $$
DECLARE
  max_existing_number BIGINT;
BEGIN
  SELECT MAX(
    SUBSTRING("employeeNumber" FROM 5)::BIGINT
  )
  INTO max_existing_number
  FROM "employees"
  WHERE "employeeNumber" ~ '^EMP-[0-9]+$';

  IF max_existing_number IS NULL THEN
    PERFORM setval(
      'employee_number_seq',
      1,
      false
    );
  ELSE
    PERFORM setval(
      'employee_number_seq',
      max_existing_number,
      true
    );
  END IF;
END
$$;

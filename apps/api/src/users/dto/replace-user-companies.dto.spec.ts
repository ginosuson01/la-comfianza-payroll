import { validate } from 'class-validator';

import { ReplaceUserCompaniesDto } from './replace-user-companies.dto';

describe('ReplaceUserCompaniesDto', () => {
  const firstCompanyId = '9c74a047-5ca5-45c3-b9ef-814c15650c41';

  const secondCompanyId = 'bc17bf87-bc80-4e39-b548-f44bedf78239';

  it('accepts valid unique company IDs', async () => {
    const dto = new ReplaceUserCompaniesDto();

    dto.companyIds = [firstCompanyId, secondCompanyId];

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts an empty company list', async () => {
    const dto = new ReplaceUserCompaniesDto();

    dto.companyIds = [];

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects duplicate company IDs', async () => {
    const dto = new ReplaceUserCompaniesDto();

    dto.companyIds = [firstCompanyId, firstCompanyId];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid company ID', async () => {
    const dto = new ReplaceUserCompaniesDto();

    dto.companyIds = ['invalid-company-id'];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});

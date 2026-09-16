import { DtrStatus } from '@payroll/database';

import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import { DtrEntriesService } from './dtr-entries.service';
import { DtrsController } from './dtrs.controller';
import { DtrsService } from './dtrs.service';
import type { CreateDtrEntryDto } from './dto/create-dtr-entry.dto';
import type { CreateDtrDto } from './dto/create-dtr.dto';
import type { ListDtrsQueryDto } from './dto/list-dtrs-query.dto';
import type { UpdateDtrEntryDto } from './dto/update-dtr-entry.dto';
import type { UpdateDtrStatusDto } from './dto/update-dtr-status.dto';

describe('DtrsController', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const employeeId = '22222222-2222-4222-8222-222222222222';

  const payrollCutoffId = '33333333-3333-4333-8333-333333333333';

  const dtrId = '44444444-4444-4444-8444-444444444444';

  const entryId = '55555555-5555-4555-8555-555555555555';

  const identity = {
    user: {
      id: actorUserId,
    },
  } as unknown as ResolvedAuthenticatedIdentity;

  const dtrsServiceMock = {
    listDtrs: jest.fn(),
    getDtrById: jest.fn(),
    createDtr: jest.fn(),
    updateDtrStatus: jest.fn(),
  };

  const dtrEntriesServiceMock = {
    createEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
  };

  let controller: DtrsController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new DtrsController(
      dtrsServiceMock as unknown as DtrsService,
      dtrEntriesServiceMock as unknown as DtrEntriesService,
    );
  });

  it('delegates DTR listing to the service', async () => {
    const query: ListDtrsQueryDto = {
      page: 1,
      pageSize: 25,
    };

    const expected = {
      items: [],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      },
    };

    dtrsServiceMock.listDtrs.mockResolvedValue(expected);

    const result = await controller.listDtrs(query);

    expect(dtrsServiceMock.listDtrs).toHaveBeenCalledWith(query);

    expect(result).toEqual(expected);
  });

  it('delegates DTR detail retrieval to the service', async () => {
    const expected = {
      id: dtrId,
    };

    dtrsServiceMock.getDtrById.mockResolvedValue(expected);

    const result = await controller.getDtrById(dtrId);

    expect(dtrsServiceMock.getDtrById).toHaveBeenCalledWith(dtrId);

    expect(result).toEqual(expected);
  });

  it('passes the authenticated user when creating a DTR', async () => {
    const input: CreateDtrDto = {
      companyId,
      employeeId,
      payrollCutoffId,
    };

    const expected = {
      id: dtrId,
    };

    dtrsServiceMock.createDtr.mockResolvedValue(expected);

    const result = await controller.createDtr(input, identity);

    expect(dtrsServiceMock.createDtr).toHaveBeenCalledWith(input, actorUserId);

    expect(result).toEqual(expected);
  });

  it('passes the authenticated user when changing DTR status', async () => {
    const input: UpdateDtrStatusDto = {
      status: DtrStatus.FOR_REVIEW,
    };

    const expected = {
      id: dtrId,
      status: DtrStatus.FOR_REVIEW,
    };

    dtrsServiceMock.updateDtrStatus.mockResolvedValue(expected);

    const result = await controller.updateDtrStatus(dtrId, input, identity);

    expect(dtrsServiceMock.updateDtrStatus).toHaveBeenCalledWith(
      dtrId,
      input,
      actorUserId,
    );

    expect(result).toEqual(expected);
  });

  it('passes the authenticated user when creating a DTR entry', async () => {
    const input: CreateDtrEntryDto = {
      workDate: '2026-09-05',
      regularMinutes: 480,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 0,
      restDay: false,
    };

    const expected = {
      id: entryId,
    };

    dtrEntriesServiceMock.createEntry.mockResolvedValue(expected);

    const result = await controller.createEntry(dtrId, input, identity);

    expect(dtrEntriesServiceMock.createEntry).toHaveBeenCalledWith(
      dtrId,
      input,
      actorUserId,
    );

    expect(result).toEqual(expected);
  });

  it('passes the authenticated user when updating a DTR entry', async () => {
    const input: UpdateDtrEntryDto = {
      lateMinutes: 30,
    };

    const expected = {
      id: entryId,
    };

    dtrEntriesServiceMock.updateEntry.mockResolvedValue(expected);

    const result = await controller.updateEntry(
      dtrId,
      entryId,
      input,
      identity,
    );

    expect(dtrEntriesServiceMock.updateEntry).toHaveBeenCalledWith(
      dtrId,
      entryId,
      input,
      actorUserId,
    );

    expect(result).toEqual(expected);
  });

  it('passes the authenticated user when deleting a DTR entry', async () => {
    const expected = {
      deleted: true,
      entryId,
    };

    dtrEntriesServiceMock.deleteEntry.mockResolvedValue(expected);

    const result = await controller.deleteEntry(dtrId, entryId, identity);

    expect(dtrEntriesServiceMock.deleteEntry).toHaveBeenCalledWith(
      dtrId,
      entryId,
      actorUserId,
    );

    expect(result).toEqual(expected);
  });
});

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import {
  DtrEntriesService,
  type CreateDtrEntriesBulkResult,
  type DeleteDtrEntryResult,
  type DtrEntryDetailRecord,
} from './dtr-entries.service';
import { CreateDtrEntriesBulkDto } from './dto/create-dtr-entries-bulk.dto';
import { CreateDtrEntryDto } from './dto/create-dtr-entry.dto';
import { CreateDtrDto } from './dto/create-dtr.dto';
import { ListDtrsQueryDto } from './dto/list-dtrs-query.dto';
import { UpdateDtrEntryDto } from './dto/update-dtr-entry.dto';
import { UpdateDtrStatusDto } from './dto/update-dtr-status.dto';
import {
  DtrsService,
  type DtrDetailRecord,
  type DtrListResponse,
} from './dtrs.service';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('dtrs')
export class DtrsController {
  constructor(
    private readonly dtrsService: DtrsService,
    private readonly dtrEntriesService: DtrEntriesService,
  ) {}

  @Get()
  listDtrs(
    @Query()
    query: ListDtrsQueryDto,
  ): Promise<DtrListResponse> {
    return this.dtrsService.listDtrs(query);
  }

  @Get(':dtrId')
  getDtrById(
    @Param('dtrId')
    dtrId: string,
  ): Promise<DtrDetailRecord> {
    return this.dtrsService.getDtrById(dtrId);
  }

  @Post()
  createDtr(
    @Body()
    input: CreateDtrDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<DtrDetailRecord> {
    return this.dtrsService.createDtr(input, identity.user.id);
  }

  @Patch(':dtrId/status')
  updateDtrStatus(
    @Param('dtrId')
    dtrId: string,

    @Body()
    input: UpdateDtrStatusDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<DtrDetailRecord> {
    return this.dtrsService.updateDtrStatus(dtrId, input, identity.user.id);
  }

  @Post(':dtrId/entries/bulk')
  createEntriesBulk(
    @Param('dtrId')
    dtrId: string,

    @Body()
    input: CreateDtrEntriesBulkDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CreateDtrEntriesBulkResult> {
    return this.dtrEntriesService.createEntriesBulk(
      dtrId,
      input,
      identity.user.id,
    );
  }

  @Post(':dtrId/entries')
  createEntry(
    @Param('dtrId')
    dtrId: string,

    @Body()
    input: CreateDtrEntryDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<DtrEntryDetailRecord> {
    return this.dtrEntriesService.createEntry(dtrId, input, identity.user.id);
  }

  @Patch(':dtrId/entries/:entryId')
  updateEntry(
    @Param('dtrId')
    dtrId: string,

    @Param('entryId')
    entryId: string,

    @Body()
    input: UpdateDtrEntryDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<DtrEntryDetailRecord> {
    return this.dtrEntriesService.updateEntry(
      dtrId,
      entryId,
      input,
      identity.user.id,
    );
  }

  @Delete(':dtrId/entries/:entryId')
  deleteEntry(
    @Param('dtrId')
    dtrId: string,

    @Param('entryId')
    entryId: string,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<DeleteDtrEntryResult> {
    return this.dtrEntriesService.deleteEntry(dtrId, entryId, identity.user.id);
  }
}

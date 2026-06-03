import { Body, Controller, Post } from "@nestjs/common";
import type { DaemonSession } from "@daemon/platform-types";
import { Protected } from "../auth/protected.decorator";
import { PolicyCheck } from "../auth/policy-check.decorator";
import { Session } from "../auth/session.decorator";
import {
  AutomationsService,
  type AutomationsApproveBody,
  type AutomationsEvaluateBody,
  type AutomationsRunBody,
} from "./automations.service";

/**
 * Automation workflows: run task steps, evaluate approvals, and commit gated writes.
 */
@Controller("v1/automations")
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Post("run")
  @Protected()
  @PolicyCheck("write", "entity")
  run(@Session() session: DaemonSession, @Body() body: AutomationsRunBody) {
    return this.automations.run(session, body);
  }

  @Post("evaluate")
  @Protected()
  @PolicyCheck("read", "entity")
  evaluate(@Body() body: AutomationsEvaluateBody) {
    return this.automations.evaluate(body);
  }

  @Post("approve")
  @Protected()
  @PolicyCheck("write", "entity")
  approve(@Session() session: DaemonSession, @Body() body: AutomationsApproveBody) {
    return this.automations.approve(session, body);
  }
}

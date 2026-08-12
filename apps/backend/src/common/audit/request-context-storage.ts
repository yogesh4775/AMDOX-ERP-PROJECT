import { AsyncLocalStorage } from "async_hooks";
import { RequestContext } from "../types/request-context.interface";

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

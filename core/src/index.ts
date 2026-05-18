export {
  createUserSchema,
  type CreateUserInput,
  updateUserSchema,
  type UpdateUserInput,
} from "./schemas/users.js";

export {
  inboundEmailSchema,
  updateTicketSchema,
  type UpdateTicketInput,
  createReplySchema,
  type CreateReplyInput,
  type Reply,
  type ReplySenderType,
  type Ticket,
  type TicketDetail,
  type TicketStatus,
  type TicketCategory,
} from "./schemas/tickets.js";

// cannister code goes here
// cannister code goes here
import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
} from "azle";
import { v4 as uuidv4 } from "uuid";

type Ticket = Record<{
  id: string;
  movie: string;
  placement: nat64;
  reserved: boolean;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type TicketPayload = Record<{
  movie: string;
  placement: nat64;
}>;

const ticketStorage = new StableBTreeMap<string, Ticket>(0, 44, 1024);

$query;
export function getTickets(): Result<Vec<Ticket>, string> {
  try {
    return Result.Ok(ticketStorage.values());
  } catch (error) {
    return Result.Err(`Error fetching tickets: ${error}`);
  }
}

$query;
export function getTicket(id: string): Result<Ticket, string> {
  try {
    return match(ticketStorage.get(id), {
      Some: (ticket) => Result.Ok<Ticket, string>(ticket),
      None: () => Result.Err<Ticket, string>(`ticket with id=${id} not found`),
    });
  } catch (error) {
    return Result.Err(`Error fetching ticket: ${error}`);
  }
}

$update;
export function addTicket(payload: TicketPayload): Result<Ticket, string> {
  if (!payload.movie || !payload.placement) {
    return Result.Err(
      "Invalid payload: movie and placement fields are required."
    );
  }
  const ticket: Ticket = {
    id: uuidv4(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
    reserved: false,
    ...payload,
  };
  try {
    ticketStorage.insert(ticket.id, ticket);
    return Result.Ok(ticket);
  } catch (error) {
    return Result.Err(`Error inserting ticket: ${error}`);
  }
}

$update;
export function buyTicket(id: string): Result<Ticket, string> {
  return match(ticketStorage.get(id), {
    Some: (ticket) => {
      const ticketToBuy: Ticket = { ...ticket };
      if (ticketToBuy.reserved)
        return Result.Err<Ticket, string>(
          `Ticket for placement ${ticketToBuy.placement} already reserved`
        );
      else {
        const reservedTicket: Ticket = {
          ...ticket,
          reserved: true,
          updatedAt: Opt.Some(ic.time()),
        };
        ticketStorage.insert(ticket.id, reservedTicket);
        return Result.Ok<Ticket, string>(reservedTicket);
      }
    },
    None: () =>
      Result.Err<Ticket, string>(`ticket with id=${id} does not exist.`),
  });
}

$update;
export function revokeTicket(id: string): Result<Ticket, string> {
  return match(ticketStorage.get(id), {
    Some: (ticket) => {
      const ticketToRevoke: Ticket = {
        ...ticket,
        updatedAt: Opt.Some(ic.time()),
      };
      if (!ticketToRevoke.reserved)
        return Result.Err<Ticket, string>(
          `Ticket with placement ${ticketToRevoke.placement} is free.`
        );
      else {
        const revokedTicket: Ticket = {
          ...ticket,
          reserved: false,
          updatedAt: Opt.Some(ic.time()),
        };
        return Result.Ok<Ticket, string>(revokedTicket);
      }
    },
    None: () =>
      Result.Err<Ticket, string>(
        `Ticket with id=${id} does not exist or has already been revoked.`
      ),
  });
}

$update;
export function deleteTicket(id: string): Result<Ticket, string> {
  try {
    return match(ticketStorage.remove(id), {
      Some: (deletedticket) => Result.Ok<Ticket, string>(deletedticket),
      None: () =>
        Result.Err<Ticket, string>(`ticket with id=${id} does not exist.`),
    });
  } catch (error) {
    return Result.Err(`Error while deleting ticket: ${error}`);
  }
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};

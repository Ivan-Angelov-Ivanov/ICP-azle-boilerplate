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
  Opt
} from 'azle';
import { v4 as uuidv4 } from 'uuid';

type Ticket = Record<{
    id: string;
    movie: string;
    placement: nat64;
    reserved: boolean;
    createdAt: nat64;
    updatedAt: Opt<nat64>
}>

type TicketPayload = Record<{
    movie: string;
    placement: nat64;
}>

const ticketStorage = new StableBTreeMap<string, Ticket>(0, 44, 1024);

$query;
export function getTickets(): Result<Vec<Ticket>, string> {
    return Result.Ok(ticketStorage.values());
}

$query;
export function getTicket(id: string): Result<Ticket, string> {
    return match(ticketStorage.get(id), {
        Some: (ticket) => Result.Ok<Ticket, string>(ticket),
        None: () => Result.Err<Ticket, string>(`Ticket with id=${id} not found`)
    });
}

$update;
export function addTicket(payload: TicketPayload): Result<Ticket, string> {
    if (payload.placement <= 0) {
        return Result.Err<Ticket, string>('Invalid placement value.');
    }
    
    const ticket: Ticket = { id: uuidv4(), createdAt: ic.time(), updatedAt: Opt.None, reserved: false, ...payload };
    ticketStorage.insert(ticket.id, ticket);
    return Result.Ok(ticket);
}

$update;
export function buyTicket(id: string): Result<Ticket, string> {
    return match(ticketStorage.get(id), {
        Some: (ticket) => {
            if (ticket.reserved) {
                return Result.Err<Ticket, string>(`Ticket for placement ${ticket.placement} already reserved`);
            } else {
                const reservedTicket: Ticket = { ...ticket, reserved: true, updatedAt: Opt.Some(ic.time()) };
                ticketStorage.insert(ticket.id, reservedTicket);
                return Result.Ok<Ticket, string>(reservedTicket);
            }
        },
        None: () => Result.Err<Ticket, string>(`Ticket with id=${id} does not exist.`)
    });
}

$update;
export function revokeTicket(id: string): Result<Ticket, string> {
    return match(ticketStorage.get(id), {
        Some: (ticket) => {
            if (!ticket.reserved) {
                return Result.Err<Ticket, string>(`Ticket with placement ${ticket.placement} is free.`);
            } else {
                const revokedTicket: Ticket = { ...ticket, reserved: false };
                return Result.Ok<Ticket, string>(revokedTicket);
            }
        },
        None: () => Result.Err<Ticket, string>(`Ticket with id=${id} does not exist.`)
    });
}

$update;
export function deleteTicket(id: string): Result<Ticket, string> {
    return match(ticketStorage.remove(id), {
        Some: (deletedTicket) => Result.Ok<Ticket, string>(deletedTicket),
        None: () => Result.Err<Ticket, string>(`Ticket with id=${id} does not exist.`)
    });
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32)

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256)
        }

        return array
    }
}

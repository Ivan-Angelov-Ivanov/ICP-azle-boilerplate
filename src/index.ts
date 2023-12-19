import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from 'azle';
import { v4 as uuidv4 } from 'uuid';

type Ticket = Record<{
    id: string;
    seller: Principal;
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

const ticketsStorage = new StableBTreeMap<string, Ticket>(0, 44, 1024);

$query;
export function getTickets(): Result<Vec<Ticket>, string> {
    if(ticketsStorage.isEmpty()){
        return Result.Err(`No tickets in storage`);
    }
    return Result.Ok(ticketsStorage.values());
}

$query;
export function getTicket(id: string): Result<Ticket, string> {
    return match(ticketsStorage.get(id), {
        Some: (ticket) => Result.Ok<Ticket, string>(ticket),
        None: () => Result.Err<Ticket, string>(`Ticket with id=${id} not found`)
    });
}

$update;
export function addTicket(payload: TicketPayload): Result<Ticket, string> {
    const ticket: Ticket = { id: uuidv4(), seller: ic.caller() ,createdAt: ic.time(), updatedAt: Opt.None, reserved: false, ...payload };
    ticketsStorage.insert(ticket.id, ticket);
    return Result.Ok(ticket);
}

$update;
export function buyTicket(id: string): Result<Ticket, string> {
    return match(ticketsStorage.get(id), {
        Some: (ticket) => {
            // returns an error message if ticket is already sold/reserved
            if (ticket.reserved)
                return Result.Err<Ticket, string>(`Ticket for placement ${ticket.placement} already reserved`)
            else {
                // sets reserved property to true, updates the updatedAt property and saves the changes to storage
                const reservedTicket: Ticket = { ...ticket, reserved: true, updatedAt: Opt.Some(ic.time()) };
                ticketsStorage.insert(ticket.id, reservedTicket);
                return Result.Ok<Ticket, string>(reservedTicket);
            }
        },
        None: () => Result.Err<Ticket, string>(`Ticket with id=${id} does not exist.`)
    });
}

$update;
export function revokeTicket(id: string): Result<Ticket, string> {
    return match(ticketsStorage.get(id), {
        Some: (ticket) => {
            // checks if the caller isn't the ticket's seller, returns an error message if true
            if(ticket.seller.toString() !== ic.caller().toString()){
                return Result.Err<Ticket,string>(`Only the seller of a ticket can revoke it.`)
            }
            // returns an error message if ticket isn't reserved
            if (!ticket.reserved)
                return Result.Err<Ticket, string>(`Ticket with placement ${ticket.placement} is free.`)
            else {
                // sets reserved property to true, updates the updatedAt property and saves the changes to storage
                const revokedTicket: Ticket = { ...ticket, reserved: false, updatedAt: Opt.Some(ic.time()) };
                ticketsStorage.insert(revokedTicket.id, revokedTicket)
                return Result.Ok<Ticket, string>(revokedTicket)
            }
        },
        None: () => Result.Err<Ticket, string>(`Ticket with id=${id} does not exist.`)
    });
}

$update;
export function deleteTicket(id: string): Result<Ticket, string> {
    return match(ticketsStorage.get(id), {
        Some: (ticket) => {
            // checks if the caller isn't the ticket's seller, returns an error message if true
            if(ticket.seller.toString() !== ic.caller().toString()){
                return Result.Err<Ticket,string>(`Only the seller of a ticket can revoke it.`)
            }
            ticketsStorage.remove(ticket.id)
            return Result.Ok<Ticket, string>(ticket)
        },
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

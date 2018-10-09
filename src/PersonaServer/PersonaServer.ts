// mco-server is a game server, written from scratch, for an old game
// Copyright (C) <2017-2018>  <Joseph W Becher>

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { Socket } from "net";
import { IRawPacket } from "../IRawPacket";
import { Logger } from "../logger";
import { NPSMsg } from "../messageTypes/NPSMsg";

const logger = new Logger().getLogger();

interface IPersonaRecord {
  customerId: number;
  id: Buffer;
  maxPersonas: Buffer;
  name: Buffer;
  personaCount: Buffer;
  shardId: Buffer;
}

/**
 * Handle a select game persona packet
 * @param {Socket} socket
 * @param {Buffer} rawData
 */
async function _npsSelectGamePersona(socket: Socket) {
  logger.debug(`_npsSelectGamePersona...`);
  // Create the packet content
  // TODO: Create a real response, instead of a random blob of bytes
  const packetContent = Buffer.alloc(251);

  // Build the packet
  // Response Code
  // 207 = success
  const responsePacket = new NPSMsg();
  responsePacket.msgNo = 0x207;
  responsePacket.setContent(packetContent);
  logger.debug(`Dumping response...`);
  responsePacket.dumpPacket();

  logger.debug(
    `[npsSelectGamePersona] responsePacket's data prior to sending: ${responsePacket.getContentAsString()}`
  );
  socket.write(responsePacket.serialize());
}

async function _npsNewGameAccount(sock: Socket) {
  const rPacket = new NPSMsg();
  rPacket.msgNo = 0x601;
  logger.debug(`Dumping response...`);
  rPacket.dumpPacket();

  sock.write(rPacket.serialize());
}

/**
 * Mark a persona as logged out
 * TODO: Change the persona record to show logged out.
 *   This requires it to exist first, it is currently hard-coded
 * TODO: Locate the connection and delete, or reset it.
 * @param {Socket} socket
 * @param {Buffer} data
 */
async function _npsLogoutGameUser(socket: Socket) {
  logger.debug(`_npsLogoutGameUser...`);
  logger.info("[personaServer] Logging out persona...");

  // Create the packet content
  // FIXME: Make a real packet, not a random blob of bytes
  const packetContent = Buffer.alloc(257);

  // Build the packet
  const responsePacket = new NPSMsg();
  responsePacket.msgNo = 0x612;
  responsePacket.setContent(packetContent);
  logger.debug(`Dumping response...`);
  responsePacket.dumpPacket();

  logger.debug(
    `[npsLogoutGameUser] responsePacket's data prior to sending: ${responsePacket.getContentAsString()}`
  );
  socket.write(responsePacket.serialize());
}

/**
 * Handle a get persona maps packet
 * @param {Socket} socket
 * @param {Buffer} data
 */
async function _npsCheckToken(socket: Socket, data: Buffer) {
  logger.debug(`_npsCheckToken...`);
  const customerId = data.readInt32BE(12);
  const plateName = data.slice(17).toString();
  logger.warn(`customerId: ${customerId}`);
  logger.warn(`Plate name: ${plateName}`);

  // Create the packet content
  // TODO: Create a real personas map packet, instead of using a fake one that (mostly) works

  const packetContent = Buffer.alloc(256);

  // Build the packet
  // NPS_ACK = 207
  const responsePacket = new NPSMsg();
  responsePacket.msgNo = 0x207;
  responsePacket.setContent(packetContent);
  logger.debug(`Dumping response...`);
  responsePacket.dumpPacket();
  // const responsePacket = buildPacket(1024, 0x0207, packetContent);

  logger.debug(
    `[npsCheckToken] responsePacket's data prior to sending: ${responsePacket.getContentAsString()}`
  );
  socket.write(responsePacket.serialize());
}

/**
 * Handle a get persona maps packet
 * @param {Socket} socket
 * @param {Buffer} data
 */
async function _npsValidatePersonaName(socket: Socket, data: Buffer) {
  logger.debug(`_npsValidatePersonaName...`);
  const customerId = data.readInt32BE(12);
  const requestedPersonaName = data
    .slice(18, data.lastIndexOf(0x00))
    .toString();
  const serviceName = data.slice(data.indexOf(0x0a) + 1).toString();
  logger.warn(`customerId: ${customerId}`);
  logger.warn(`Requested persona name: ${requestedPersonaName}`);
  logger.warn(`Service name: ${serviceName}`);

  // Create the packet content
  // TODO: Create a real personas map packet, instead of using a fake one that (mostly) works

  const packetContent = Buffer.alloc(256);

  // Build the packet
  // NPS_USER_VALID     validation succeeded
  const responsePacket = new NPSMsg();
  responsePacket.msgNo = 0x601;
  responsePacket.setContent(packetContent);
  logger.debug(`Dumping response...`);
  responsePacket.dumpPacket();

  logger.debug(
    `[npsValidatePersonaName] responsePacket's data prior to sending: ${responsePacket.getContentAsString()}`
  );
  socket.write(responsePacket.serialize());
}

export class PersonaServer {
  private personaList: IPersonaRecord[] = [
    {
      customerId: 2868969472,
      id: Buffer.from([0x00, 0x00, 0x00, 0x01]),
      maxPersonas: Buffer.from([0x01]),
      name: this._generateNameBuffer("Doc Joe"),
      personaCount: Buffer.from([0x00, 0x01]),
      shardId: Buffer.from([0x00, 0x00, 0x00, 0x2c]),
    },
    {
      customerId: 5551212,
      id: Buffer.from([0x00, 0x84, 0x5f, 0xed]),
      maxPersonas: Buffer.from([0x02]),
      name: this._generateNameBuffer("Dr Brown"),
      personaCount: Buffer.from([0x00, 0x01]),
      shardId: Buffer.from([0x00, 0x00, 0x00, 0x2c]),
    },
  ];

  public _generateNameBuffer(name: string) {
    const nameBuffer = Buffer.alloc(30);
    Buffer.from(name, "utf8").copy(nameBuffer);
    return nameBuffer;
  }

  /**
   * Route an incoming persona packet to the connect handler
   * @param {Socket} socket
   * @param {Buffer} rawData
   */
  public async dataHandler(rawPacket: IRawPacket) {
    const { connection, data, localPort, remoteAddress } = rawPacket;
    const { sock } = connection;
    const updatedConnection = connection;
    logger.info(`=============================================
    Received packet on port ${localPort} from ${remoteAddress}...`);
    logger.info("=============================================");
    const requestCode = data.readUInt16BE(0).toString(16);

    switch (requestCode) {
      case "503":
        // NPS_REGISTER_GAME_LOGIN = 0x503
        await _npsSelectGamePersona(sock);
        return updatedConnection;

      case "507":
        // NPS_NEW_GAME_ACCOUNT == 0x507
        await _npsNewGameAccount(sock);
        return updatedConnection;

      case "50f":
        // NPS_REGISTER_GAME_LOGOUT = 0x50F
        await _npsLogoutGameUser(sock);
        return updatedConnection;
      case "532":
        // NPS_GET_PERSONA_MAPS = 0x532
        await this._npsGetPersonaMaps(sock, data);
        return updatedConnection;
      case "533":
        // NPS_VALIDATE_PERSONA_NAME   = 0x533
        await _npsValidatePersonaName(sock, data);
        return updatedConnection;
      case "534":
        // NPS_CHECK_TOKEN   = 0x534
        await _npsCheckToken(sock, data);
        return updatedConnection;
      default:
        throw new Error(
          `[personaServer] Unknown code ${requestCode} was received on port 8228`
        );
    }
  }

  public _getPersonasByCustomerId(customerId: number) {
    let results;
    results = this.personaList.find(persona => {
      const match = customerId === persona.customerId;
      return match;
    });
    if (!results) {
      throw new Error(
        `Unable to locate a persona for customerId: ${customerId}`
      );
    }
    return results;
  }

  public _getPersonasById(id: number) {
    let results;
    results = this.personaList.find(persona => {
      const match = id === persona.id.readInt32BE(0);
      return match;
    });
    if (!results) {
      throw new Error(`Unable to locate a persona for id: ${id}`);
    }
    return results;
  }

  /**
   * Lookup all personas owned by the customer id
   * TODO: Store in a database, instead of being hard-coded
   * @param {Int} customerId
   */
  public async _npsGetPersonaMapsByCustomerId(customerId: number) {
    // const name = Buffer.alloc(30);

    switch (customerId) {
      case 2868969472:
        return this._getPersonasByCustomerId(customerId);
      case 5551212:
        return this._getPersonasByCustomerId(customerId);
      default:
        throw new Error(
          `[personaServer/npsGetPersonaMapsByCustomerId] Unknown customerId: ${customerId}`
        );
    }
  }

  /**
   * Handle a get persona maps packet
   * @param {Socket} socket
   * @param {Buffer} data
   */
  public async _npsGetPersonaMaps(socket: Socket, data: Buffer) {
    logger.debug(`_npsGetPersonaMaps...`);
    const customerId = Buffer.alloc(4);
    data.copy(customerId, 0, 12);
    logger.info(
      `npsGetPersonaMaps for customerId: ${customerId.readUInt32BE(0)}`
    );
    const persona = await this._npsGetPersonaMapsByCustomerId(
      customerId.readUInt32BE(0)
    );

    if (persona === undefined) {
      throw new Error("persona undefined in npsGetPersonaMaps");
    } else {
      // Create the packet content
      // TODO: Create a real personas map packet, instead of using a fake one that (mostly) works
      const packetContent = Buffer.alloc(68);

      // This is the persona count
      persona.personaCount.copy(packetContent, 8);

      // This is the max persona count (confirmed - debug)
      persona.maxPersonas.copy(packetContent, 13);

      // PersonaId
      persona.id.copy(packetContent, 16);

      // Shard ID
      persona.shardId.copy(packetContent, 20);

      // No clue
      Buffer.from([0x0a, 0x0d]).copy(packetContent, 28);

      // Persona Name = 30-bit null terminated string
      persona.name.copy(packetContent, 30);

      // Build the packet
      const responsePacket = new NPSMsg();
      responsePacket.msgNo = 0x607;
      responsePacket.setContent(packetContent.slice(0, 68));
      logger.debug(`Dumping response...`);
      responsePacket.dumpPacket();

      logger.debug(
        `[npsGetPersonaMaps] responsePacket's data prior to sending: ${responsePacket.getContentAsString()}`
      );

      socket.write(responsePacket.serialize());
    }
  }
}
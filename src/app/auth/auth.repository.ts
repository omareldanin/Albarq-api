import {prisma} from "../../database/db";
import type {UserSigninType} from "./auth.dto";
import {userReform, userSelect} from "./auth.responses";

export class AuthRepository {
  async signin(user: UserSigninType) {
    const returnedUser = await prisma.user.findFirst({
      where: {
        username: user.username,
        OR: [
          {
            employee: {
              deleted: false,
            },
          },
          {
            client: {
              deleted: false,
            },
          },
          {
            admin: {
              role: "ADMIN",
            },
          },
        ],
      },
      select: userSelect,
    });
    return userReform(returnedUser);
  }

  async getUserByID(userID: number) {
    const returnedUser = await prisma.user.findUnique({
      where: {
        id: userID,
      },
      select: userSelect,
    });
    return userReform(returnedUser);
  }

  async getPasswordHash(userID: number) {
    const user = await prisma.user.findUnique({
      where: {id: userID},
      select: {password: true},
    });
    return user?.password ?? null;
  }

  /** New password + end every other session (refresh tokens). */
  async setPassword(userID: number, hashedPassword: string) {
    await prisma.user.update({
      where: {id: userID},
      data: {password: hashedPassword, refreshTokens: {set: []}},
    });
  }

  async signoutUser(userID: number) {
    await prisma.user.update({
      where: {
        id: userID,
      },
      data: {
        refreshTokens: {
          set: [],
        },
      },
    });
  }
}

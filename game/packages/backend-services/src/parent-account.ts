/**
 * The only store allowed to hold child personal data or parent contact data.
 * Other services keep a pseudonymous player id. Production encrypts `email`
 * at rest in its own schema and key. This stub is in-memory and synthetic.
 */

export interface ParentAccount {
  id: string
  email: string
  country: string
  createdAt: string
  vpcMethod: 'pending' | 'card_check' | 'id_check'
  status: 'pending' | 'verified' | 'revoked'
}

export interface ChildProfile {
  id: string
  parentId: string
  /** Year only. A full birth date is more than we need. */
  birthYear: number
  generatedNameId: number
  locale: string
  playerId: string
}

export interface ParentControls {
  parentId: string
  childId: string
  dailyMinutes: number
  friendsEnabled: boolean
  quickChatEnabled: boolean
  coinShopEnabled: boolean
}

export class ParentAccountStore {
  private readonly parents = new Map<string, ParentAccount>()
  private readonly children = new Map<string, ChildProfile>()
  private readonly controls = new Map<string, ParentControls>()

  register(input: { email: string; country: string }): ParentAccount {
    const account: ParentAccount = {
      id: `par_${this.parents.size + 1}`,
      email: input.email,
      country: input.country,
      createdAt: new Date().toISOString(),
      vpcMethod: 'pending',
      status: 'pending',
    }
    this.parents.set(account.id, account)
    return account
  }

  addChild(parentId: string, birthYear: number, locale: string): ChildProfile {
    const parent = this.parents.get(parentId)
    if (!parent) throw new Error('unknown parent')
    const owned = [...this.children.values()].filter((c) => c.parentId === parentId)
    if (owned.length >= 4) throw new Error('a parent account holds at most 4 children')
    const child: ChildProfile = {
      id: `chi_${this.children.size + 1}`,
      parentId,
      birthYear,
      generatedNameId: this.children.size + 1,
      locale,
      playerId: `ply_${this.children.size + 1}`,
    }
    this.children.set(child.id, child)
    this.controls.set(child.id, {
      parentId,
      childId: child.id,
      dailyMinutes: 60,
      friendsEnabled: false,
      quickChatEnabled: true,
      coinShopEnabled: false,
    })
    return child
  }

  getControls(childId: string): ParentControls | undefined {
    const row = this.controls.get(childId)
    return row ? { ...row } : undefined
  }

  /** What every other service is allowed to learn about a child. */
  pseudonym(childId: string): { playerId: string } | undefined {
    const child = this.children.get(childId)
    return child ? { playerId: child.playerId } : undefined
  }
}

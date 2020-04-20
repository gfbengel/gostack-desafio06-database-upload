import { getCustomRepository, getRepository } from 'typeorm'

import AppError from '../errors/AppError'

import Transaction from '../models/Transaction'
import TransactionsRepository from '../repositories/TransactionsRepository'

import Category from '../models/Category'

interface Request {
  title: string
  value: number
  type: 'income' | 'outcome'
  category: string
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository)

    const categoriesRepository = getRepository(Category)

    if (!['income', 'outcome'].includes(type)) {
      throw new AppError('Transaction type is invalid.')
    }

    if (type === 'outcome') {
      const { total } = await transactionsRepository.getBalance()
      if (value > total) {
        throw new AppError(
          "You don't have enough balance to execute this transaction.",
        )
      }
    }

    let transactionCategory = await categoriesRepository.findOne({
      where: { title: category },
    })

    if (!transactionCategory) {
      transactionCategory = await categoriesRepository.create({
        title: category,
      })
      await categoriesRepository.save(transactionCategory)
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: transactionCategory,
    })

    await transactionsRepository.save(transaction)

    return transaction
  }
}

export default CreateTransactionService

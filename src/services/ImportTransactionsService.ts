import { getCustomRepository, getRepository, In } from 'typeorm'
import csvParse from 'csv-parse'
import fs from 'fs'

import AppError from '../errors/AppError'
import TransactionsRepository from '../repositories/TransactionsRepository'
import Transaction from '../models/Transaction'
import Category from '../models/Category'

interface CSVTransaction {
  title: string
  value: number
  type: 'income' | 'outcome'
  category: string
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository)
    const categoriesRepository = getRepository(Category)

    const contactsReadStream = fs.createReadStream(filePath)

    const parsers = csvParse({ from_line: 2 })

    const parseCSV = contactsReadStream.pipe(parsers)

    const transactions: CSVTransaction[] = []
    const categories: string[] = []
    /* const balance = {
      income: 0,
      outcome: 0,
      total: 0,
    } */

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      )

      if (!title || !type || !value) return

      /* switch (type) {
        case 'income':
          balance.income += Number(value)
          break
        case 'outcome':
          if (value > balance.total) {
            throw new AppError(
              "You don't have enough balance to execute this transaction.",
            )
          }
          balance.outcome += Number(value)
          break
        default:
          break
      }
      balance.total = balance.income - balance.outcome */

      categories.push(category)

      transactions.push({
        title,
        type,
        value,
        category,
      })
    })

    await new Promise((resolve, reject) => {
      parseCSV.on('error', err => reject(err))
      parseCSV.on('end', resolve)
    })

    const existentCategories = await categoriesRepository.find({
      where: { title: In(categories) },
    })

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    )

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index)

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({ title })),
    )

    await categoriesRepository.save(newCategories)

    const finalCategories: Category[] = [
      ...newCategories,
      ...existentCategories,
    ]

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    )

    await transactionsRepository.save(createdTransactions)
    await fs.promises.unlink(filePath)

    return createdTransactions
  }
}

export default ImportTransactionsService
